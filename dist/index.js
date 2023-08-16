import React, { createContext, useReducer, useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';

function translateTypeToStatusByte(type) {
    switch (type) {
        case ('noteOff'): return 0x80;
        case ('noteOn'): return 0x90;
        case ('afterTouch'): return 0xA0;
        case ('cc'): return 0xB0;
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
    return 'No device specified';
}
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
const MIDIContext = createContext({});
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
    const { children, onError } = props;
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
    const [midiAccess, setMIDIAccess] = useState(null);
    const [midiInputs, setMIDIInputs] = useState([]);
    const [midiOutputs, setMIDIOutputs] = useState([]);
    useEffect(() => {
        initializeMIDI(onError);
    }, []);
    const initializeMIDI = useCallback(async (onError) => {
        try {
            if (!('requestMIDIAccess' in navigator))
                throw new Error('MIDI is not supported in this browser.');
            const tempMidiAccess = await navigator.requestMIDIAccess();
            setMIDIAccess(() => tempMidiAccess);
            setMIDIInputs(() => ([...tempMidiAccess.inputs].map((input) => (input[1]))));
            setMIDIOutputs(() => ([...tempMidiAccess.outputs].map((output) => (output[1]))));
        }
        catch (error) {
            onError(error);
        }
    }, []);
    const addMIDIInput = useCallback(async (input, callback) => {
        try {
            if (!midiAccess || !('inputs' in midiAccess))
                throw new Error('inputs not available.');
            await openMIDIInput({ input, callback });
            setConnectedMIDIInputs({ type: 'add', value: input });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [midiInputs, midiAccess, connectedMIDIInputs]);
    const removeMIDIInput = useCallback((input) => {
        try {
            closeMIDIInput(input);
            setConnectedMIDIInputs({ type: 'remove', value: input });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [midiInputs, midiAccess, connectedMIDIInputs]);
    const addMIDIOutput = useCallback((output) => {
        try {
            if (!midiAccess || !('outputs' in midiAccess))
                throw new Error('outputs not available.');
            setConnectedMIDIOutputs({ type: 'add', value: output });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [midiOutputs, midiAccess, connectedMIDIOutputs]);
    const removeMIDIOutput = useCallback((output) => {
        try {
            setConnectedMIDIOutputs({ type: 'remove', value: output });
            return true;
        }
        catch (error) {
            return false;
        }
    }, [midiOutputs, midiAccess, connectedMIDIOutputs]);
    const sendMIDICC = useCallback((args) => {
        const { channel, cc, value, device, } = args;
        if (typeof (channel) !== 'number')
            throw new Error(`no channel provided for cc. Expected a number and received ${channel}`);
        if (typeof (cc) !== 'number')
            throw new Error(`no cc# provided for cc. Expected a number and received ${cc}`);
        if (typeof (value) !== 'number')
            throw new Error(`no value provided for cc. Expected a number and received ${value}`);
        if (!device)
            throw new Error(`no device provided for cc. Expected a MIDIOutputDevice and recieved ${device}`);
        sendMIDIMessage({
            channel, cc, value, device, type: 'cc',
        });
        setMIDIValue({
            channel, cc, value, device,
        });
    }, [connectedMIDIOutputs, sendMIDIMessage]);
    const sendMIDINoteOn = useCallback((args) => {
        const { channel, pitch, value, device, velocity, } = args;
        if (typeof (channel) !== 'number')
            throw new Error(`no channel provided for noteOn. Expected a number and received ${channel}`);
        if (typeof (pitch) !== 'number')
            throw new Error(`no pitch provided for noteOn. Expected a number and received ${pitch}`);
        if (typeof (velocity) !== 'number' && typeof (value) !== 'number')
            throw new Error(`no value/velocity provided for noteOn. Expected a number and received ${velocity !== null && velocity !== void 0 ? velocity : value}`);
        if (!device)
            throw new Error(`no device provided for noteOn. Expected a MIDIOutputDevice and recieved ${device}`);
        sendMIDIMessage({
            channel, pitch, value: value !== null && value !== void 0 ? value : velocity, device, type: 'noteOn',
        });
    }, [connectedMIDIOutputs, sendMIDIMessage]);
    const sendMIDINoteOff = useCallback((args) => {
        const { channel, pitch, device, } = args;
        if (typeof (channel) !== 'number')
            throw new Error(`no channel provided for noteOff. Expected a number and received ${channel}`);
        if (typeof (pitch) !== 'number')
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
    }), [midiInputs, midiOutputs, connectedMIDIInputs, connectedMIDIOutputs, midiAccess]);
    return (React.createElement(MIDIContext.Provider, { value: value }, children));
}
function useMIDIContext(selector) {
    const latestSelectedStateRef = useRef();
    const latestSelectedResultRef = useRef();
    const valueFromContext = useContext(MIDIContext);
    const selectedState = selector(valueFromContext);
    if (selectedState !== latestSelectedStateRef.current) {
        latestSelectedStateRef.current = selectedState;
        latestSelectedResultRef.current = selectedState;
    }
    return latestSelectedResultRef.current;
}
function useMIDI(props) {
    const { channel, cc, device } = props !== null && props !== void 0 ? props : {};
    if (typeof (channel) == 'number' && typeof (cc) == 'number') {
        const send = (value) => {
            sendMIDIMessage({
                channel, cc, value, device, type: 'cc'
            });
        };
        return {
            sendMIDIMessage: send,
        };
    }
    return useMIDIContext((cv) => cv);
}
function useMIDIOutput(requestedDevice) {
    const midiOutputs = useMIDIContext((cv) => cv.midiOutputs);
    const sendMIDICC = useMIDIContext((cv) => cv.sendMIDICC);
    const sendMIDIMessage = useMIDIContext((cv) => cv.sendMIDIMessage);
    const sendMIDINoteOn = useMIDIContext((cv) => cv.sendMIDINoteOn);
    const sendMIDINoteOff = useMIDIContext((cv) => cv.sendMIDINoteOff);
    let device = (typeof (requestedDevice) == 'number')
        ? midiOutputs[requestedDevice]
        : midiOutputs.filter((device) => (device.name === requestedDevice))[0];
    if (!device) {
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
    const midiInputs = useMIDIContext(cv => cv.midiInputs);
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
        return null;
    }
}
function useMIDIActions(device) {
    const sendMIDICC = useMIDIContext((cv) => cv.sendMIDICC);
    const sendMIDIMessage = useMIDIContext((cv) => cv.sendMIDIMessage);
    const sendMIDINoteOn = useMIDIContext((cv) => cv.sendMIDINoteOn);
    const sendMIDINoteOff = useMIDIContext((cv) => cv.sendMIDINoteOff);
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
const index = { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions, useMIDIContext };

export { MIDIProvider, index as default, useMIDI, useMIDIActions, useMIDIContext, useMIDIInput, useMIDIOutput };
//# sourceMappingURL=index.js.map
