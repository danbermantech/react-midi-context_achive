import React, { createContext, useReducer, useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';

/**
 * @module MIDIContext
 */
/**
 * @typedef {string} StatusByte
 * @property {number} noteOff - 0x8
 * @property {number} noteOn - 0x9
 * @property {number} afterTouch - 0xA
 * @property {number} controlChange - 0xB
 * @property {number} programChange - 0xC
 * @property {number} channelPressure - 0xD
 * @property {number} pitchWheel - 0xE
 */
function translateTypeToStatusByte(type) {
    switch (type) {
        case ('noteOff'): return 0x80;
        case ('noteOn'): return 0x90;
        case ('afterTouch'):        case ('cc'): return 0xB0;
        case ('controlChange'): return 0xB0;
        case ('programChange'): return 0xC0;
        case ('channelPressure'): return 0xD0;
        case ('pitchWheel'): return 0xE0;
        default: return 0x00;
    }
}
function sendMIDIMessage(props) {
    const { channel, cc, value, pitch, device, type = 'cc', log, } = props;
    const firstStatusByte = translateTypeToStatusByte(type);
    const statusBytes = firstStatusByte + (channel !== null && channel !== void 0 ? channel : 0);
    const msg = [statusBytes, pitch || (cc || 0), value || 0];
    if (device) {
        if (device.constructor === Array) {
            device.forEach((d) => d === null || d === void 0 ? void 0 : d.send(msg));
            return `messages sent successfully to multiple outputs : ${msg}`;
        }
        if (!Array.isArray(device)) {
            try {
                device.send(msg);
            }
            catch (error) {
                if (log)
                    console.warn(error);
                return 'an error occured.';
            }
            return `MIDI message successfully sent : ${msg}`;
        }
    }
    return 'No device specified';
}
/**
 * @param {Event} event - a MIDI input event
 * @returns {Object} Object `{data: event.data, timeStamp: event.timeStamp, str: str}`
 */
function onMIDIMessage(event) {
    let str = '';
    for (let i = 0; i < event.data.length; i += 1) {
        str += `0x${event.data[i].toString(16)} `;
    }
    return { data: event.data, timeStamp: event.timeStamp, str };
}
async function openMIDIInput(props) {
    const { input, callback } = props;
    if (typeof (input) !== 'object')
        return new Error('No input supplied');
    if (input.connection === 'open' && !callback)
        return input;
    input.onmidimessage = (msg) => onMIDIMessage(msg);
    if (typeof (callback) === 'function') {
        const cb = (msg) => {
            const message = onMIDIMessage(msg);
            const stateObj = { relVal: 'mostRecentMessage', input: message };
            callback(stateObj);
        };
        input.onmidimessage = (msg) => cb(msg);
    }
    await input.open();
    return input;
}
/**
 * @description Closes and returns the input
 * @param {MIDIInput} input
 * @returns {MIDIInput}
 */
async function closeMIDIInput(input) {
    await input.close();
    return input;
}
const MIDIContext = createContext({
    initializeMIDI: function () { },
    openMIDIInput: function () { },
    onMIDIMessage: function () { },
    sendMIDIMessage: function () { },
    sendMIDICC: function () { },
    sendMIDINoteOn: function () { },
    sendMIDINoteOff: function () { },
    midiAccess: {},
    midiInputs: [],
    midiOutputs: [],
    connectedMIDIInputs: [],
    addMIDIInput: function () { },
    removeMIDIInput: function () { },
    connectedMIDIOutputs: [],
    setConnectedMIDIOutputs: function () { },
    addMIDIOutput: function () { },
    removeMIDIOutput: function () { },
});
function useStoreData() {
    const store = useRef({ byDevice: {}, byChannel: {} });
    const get = useCallback((props) => {
        if (!props)
            return store.current;
        const { channel, cc, device } = props;
        if (device) {
            return [...store.current.byDevice[device.id]].filter((record) => {
                if (channel && (record.channel !== channel))
                    return false;
                if (cc && (record.cc !== cc))
                    return false;
                return true;
            });
        }
        if (!channel)
            return store.current;
        if (!cc)
            return store.current.byChannel[channel];
        return store.current.byChannel[channel][cc];
    }, []);
    const set = useCallback((value) => {
        var _a;
        store.current = {
            byChannel: Object.assign(Object.assign({}, store.current.byChannel), { [value.channel]: Object.assign(Object.assign({}, store.current.byChannel[value.channel]), { [value.cc]: value.value }) }),
            byDevice: Object.assign(Object.assign({}, store.current.byDevice), { [value.device.id]: Object.assign(Object.assign({}, store.current.byDevice[value.device.id]), { [value.channel]: Object.assign(Object.assign({}, (_a = store.current.byDevice[value.device.id]) === null || _a === void 0 ? void 0 : _a[value.channel]), { [value.cc]: value.value }) }) }),
        };
    }, []);
    const subscribers = useRef(new Set());
    const subscribe = useCallback((callback) => {
        subscribers.current.add(callback);
        return () => subscribers.current.delete(callback);
    }, [subscribers]);
    return {
        get,
        set,
        subscribe,
    };
}
function MIDIProvider(props) {
    const { children } = props;
    function reducer(state, action) {
        switch (action.type) {
            case 'add':
                return [...new Set([...state, action.value])];
            case 'remove':
                return state.filter((item) => (!(action.value.id === item.id)));
            default:
                throw new Error();
        }
    }
    const [connectedMIDIInputs, setConnectedMIDIInputs] = useReducer(reducer, []);
    const [connectedMIDIOutputs, setConnectedMIDIOutputs] = useReducer(reducer, []);
    const { get: getMIDIValue, set: setMIDIValue, subscribe } = useStoreData();
    const [midiAccess, setMIDIAccess] = useState({});
    const [midiInputs, setMIDIInputs] = useState([]);
    const [midiOutputs, setMIDIOutputs] = useState([]);
    useEffect(() => {
        initializeMIDI();
    }, []);
    /**
   * @function initializeMIDI
   * @returns {object} an object with midi inputs and outputs
   */
    async function initializeMIDI() {
        if (!('requestMIDIAccess' in navigator))
            return Promise.reject(new Error('MIDI is not supported in this browser.'));
        //@ts-ignore
        const tempMidiAccess = await navigator.requestMIDIAccess();
        setMIDIAccess(() => tempMidiAccess);
        const tmpInputs = [...tempMidiAccess.inputs].map((input) => (input[1]));
        //@ts-ignore
        setMIDIInputs(() => tmpInputs);
        const tmpOutputs = [...tempMidiAccess.outputs].map((output) => (output[1]));
        //@ts-ignore
        setMIDIOutputs(() => tmpOutputs);
        return { midiAccess, midiInputs, midiOutputs };
    }
    /**
     * @function addMIDIInput
     * @param {MIDIInput} input - the input to add
     */
    const addMIDIInput = useCallback((input, callback) => {
        try {
            if (!('inputs' in midiAccess))
                throw new Error('inputs not available.');
            openMIDIInput({ input, callback });
            setConnectedMIDIInputs({ type: 'add', value: input });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [connectedMIDIInputs]);
    /**
     * @function removeMIDIInput
     * @param {MIDIInput} input - the input to remove
     */
    const removeMIDIInput = useCallback((input) => {
        try {
            closeMIDIInput(input);
            setConnectedMIDIInputs({ type: 'remove', value: input });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [connectedMIDIInputs]);
    /**
     * @function addMIDIOutput
     * @param {MIDIOutput} output - the output to add
     */
    const addMIDIOutput = useCallback((output) => {
        try {
            if (!('outputs' in midiAccess))
                throw new Error('outputs not available.');
            setConnectedMIDIOutputs({ type: 'add', value: output });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [connectedMIDIOutputs]);
    /**
     * @function removeMIDIOutput
     * @param {MIDIOutput} output - the output to remove
     */
    const removeMIDIOutput = useCallback((output) => {
        try {
            setConnectedMIDIOutputs({ type: 'remove', value: output });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [connectedMIDIOutputs]);
    /**
     * @function sendMIDICC
     * @param {number} args.channel - the channel to send the command on
     * @param {number} args.cc - the CC# to send the command on
     * @param {number} args.value = the value to send
     * @param {MIDIOutput} args.device - the device to send the command on
     */
    const sendMIDICC = useCallback((args) => {
        const { channel, cc, value, device, } = args;
        if (!channel)
            throw new Error(`no channel provided for cc. Expected a number and received ${channel}`);
        if (!cc)
            throw new Error(`no cc# provided for cc. Expected a number and received ${cc}`);
        if (!device)
            throw new Error(`no device provided for cc. Expected a MIDIOutputDevice and recieved ${device}`);
        if (!(value))
            throw new Error(`no value provided for noteOn. Expected a number and received ${value}`);
        sendMIDIMessage({
            channel, cc, value, device, type: 'cc',
        });
        setMIDIValue({
            channel, cc, value, device,
        });
    }, [connectedMIDIOutputs, sendMIDIMessage]);
    /**
     * @function sendMIDINoteOn
     * @param {number} args.channel - the channel to send the command on
     * @param {number} args.pitch - the pitch to send
     * @param {number} [args.value] = the value to send
     * @param {number} [args.velocity] - alias of value
     * @param {MIDIOutput} args.device - the device to send the command on
     */
    const sendMIDINoteOn = useCallback((args) => {
        const { channel, pitch, value, device, velocity, } = args;
        if (!channel)
            throw new Error(`no channel provided for noteOn. Expected a number and received ${channel}`);
        if (!pitch)
            throw new Error(`no pitch provided for noteOn. Expected a number and received ${pitch}`);
        if (!device)
            throw new Error(`no device provided for noteOn. Expected a MIDIOutputDevice and recieved ${device}`);
        if (!(velocity || value))
            throw new Error(`no value/velocity provided for noteOn. Expected a number and received ${velocity !== null && velocity !== void 0 ? velocity : value}`);
        sendMIDIMessage({
            channel, pitch, value: value !== null && value !== void 0 ? value : velocity, device, type: 'noteOn',
        });
    }, [connectedMIDIOutputs, sendMIDIMessage]);
    /**
     * @function sendMIDINoteOff
     * @param {number} args.channel - the channel to send the command on
     * @param {number} args.pitch - the pitch to send
     * @param {MIDIOutput} args.device - the device to send the command on
     */
    const sendMIDINoteOff = useCallback((args) => {
        const { channel, pitch, device, } = args;
        if (!channel)
            throw new Error(`no channel provided for noteOff. Expected a number and received ${channel}`);
        if (!pitch)
            throw new Error(`no pitch provided for noteOff. Expected a number and received ${pitch}`);
        if (!device)
            throw new Error(`no device provided for noteOff. Expected a MIDIOutputDevice and received ${device}`);
        sendMIDIMessage({
            channel, pitch, value: 0, device, type: 'noteOff',
        });
    }, [connectedMIDIOutputs, sendMIDIMessage]);
    const value = useMemo(() => ({
        initializeMIDI,
        openMIDIInput,
        onMIDIMessage,
        getMIDIValue,
        sendMIDIMessage,
        sendMIDICC,
        sendMIDINoteOn,
        sendMIDINoteOff,
        midiAccess,
        midiInputs,
        midiOutputs,
        connectedMIDIInputs,
        addMIDIInput,
        removeMIDIInput,
        connectedMIDIOutputs,
        setConnectedMIDIOutputs,
        addMIDIOutput,
        removeMIDIOutput,
        subscribe,
    }), [connectedMIDIInputs, connectedMIDIOutputs, midiAccess]);
    return (React.createElement(MIDIContext.Provider, { value: value }, children));
}
function useMIDIContext() {
    return useContext(MIDIContext);
}
function useMIDI(props) {
    if (!props || !('channel' in props && 'cc' in props && 'device' in props))
        return useMIDIContext();
    const { channel, cc, device } = props;
    const send = (value) => {
        sendMIDIMessage({
            channel, cc, value, device, type: 'cc'
        });
    };
    return {
        sendMIDIMessage: send,
    };
}
function useMIDIOutput(requestedDevice) {
    const { midiOutputs, sendMIDICC, sendMIDIMessage, sendMIDINoteOn, sendMIDINoteOff } = useMIDIContext();
    let device;
    if (typeof (requestedDevice) == 'number')
        device = midiOutputs[requestedDevice];
    else
        device = midiOutputs.filter((device) => (device.name === requestedDevice))[0];
    if (typeof (device) === 'undefined') {
        return {
            device,
            sendMIDICC: () => { },
            sendMIDIMessage: () => { },
            sendMIDINoteOn: () => { },
            sendMIDINoteOff: () => { }
        };
    }
    return {
        device,
        sendMIDICC: (command) => {
            sendMIDICC(Object.assign({ device }, command));
        },
        sendMIDIMessage: (command) => {
            sendMIDIMessage(Object.assign({ device }, command));
        },
        sendMIDINoteOn: (command) => {
            sendMIDINoteOn(Object.assign({ device }, command));
        },
        sendMIDINoteOff: (command) => {
            sendMIDINoteOff(Object.assign({ device }, command));
        },
    };
}
function useMIDIInput(requestedDevice) {
    const { midiInputs } = useMIDIContext();
    let device;
    try {
        if (typeof (requestedDevice) == 'number') {
            device = midiInputs[requestedDevice];
        }
        else {
            device = midiInputs.filter((device) => (device.name === requestedDevice))[0];
        }
        if (!('connection' in device))
            throw new Error('no device');
        if (device.connection == 'closed')
            device.open();
        return device;
    }
    catch (err) {
        return {
            connection: 'disconnected',
            id: 'err',
            manufacturer: 'err',
            name: 'err',
            state: 'disconnected',
            type: 'output',
            open: () => { },
            close: () => { },
            version: '0',
        };
    }
}
function useMIDIActions(device) {
    const { sendMIDICC, sendMIDIMessage, sendMIDINoteOn, sendMIDINoteOff } = useMIDIContext();
    if (!device) {
        return { sendMIDICC, sendMIDIMessage, sendMIDINoteOn, sendMIDINoteOff };
    }
    return {
        sendMIDICC: (command) => {
            sendMIDICC(Object.assign({ device }, command));
        },
        sendMIDIMessage: (command) => {
            sendMIDIMessage(Object.assign({ device }, command));
        },
        sendMIDINoteOn: (command) => {
            sendMIDINoteOn(Object.assign({ device }, command));
        },
        sendMIDINoteOff: (command) => {
            sendMIDINoteOff(Object.assign({ device }, command));
        },
    };
}
/**
 * @typedef MIDIOutput
 * @type {object}
 * @description Native js {@link https://developer.mozilla.org/en-US/docs/Web/API/MIDIOutput|MIDIOutput} object. Inherits properties from {@link https://developer.mozilla.org/en-US/docs/Web/API/MIDIPort|MIDIPort}
 * @property {string} id - the device id ("output" + it's order it the MIDIOutputList + 1)
 * @property {("open"|"closed"|"pending")} connection - connection status of the device,
 * eg: whether it is being used by the app
 * @property {string} manufacturer - the device manufacturer if available, or an empty string
 * @property {} onstatechange - DLSKJFJLSKDNFLKSNDFLKNSDLFKNSDLKFNLSKDFNLSKDNFL
 * @property {("connected"|"disconnected")} state - Indicates whether the device
 * is connected to the system
 * @property {"output"} type - the MIDIPort type (always output)
 * @property {string} version - version of the port, usually "1.0"
 */
const index = { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions };

export { MIDIProvider, index as default, useMIDI, useMIDIActions, useMIDIInput, useMIDIOutput };
//# sourceMappingURL=index.js.map