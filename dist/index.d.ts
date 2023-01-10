/**
 * @module MIDIContext
 */
import React from 'react';
/**
 * @function sendMIDIMessage
 * @param {Object} props
 * @param {int} props.channel
 * @param {int} props.cc
 * @param {int} props.value
 * @param {int} props.pitch
 * @param {MIDIOutput} props.device
 * @param {StatusByte} props.type
 * @param {boolean} props.log
 * @returns {string}
 */
export interface MIDIPort {
    connection: string;
    id: string;
    manufacturer: string;
    onstatechange?: Function;
    name?: string;
    state: string;
    type: string;
    version: string;
}
export interface MIDIOutput extends MIDIPort {
    send: Function;
}
export interface MIDICommand {
    channel?: number;
    cc?: number;
    value?: number;
    velocity?: number;
    pitch?: number;
    device?: MIDIOutput | MIDIOutput[];
    type?: string;
    log?: boolean;
}
/**
 * @param {MIDIInput} props.input - an input from the MIDIAccess object
 * @returns {MIDIInput}
 */
export interface MIDIInput extends MIDIPort {
    onmidimessage?: Function;
    open: Function;
    close: Function;
}
export interface MIDIActions {
    initializeMIDI: Function;
    openMIDIInput: Function;
    onMIDIMessage: Function;
    sendMIDIMessage: Function;
    sendMIDICC: Function;
    sendMIDINoteOn: Function;
    sendMIDINoteOff: Function;
    getMIDIValue: Function;
    midiAccess: Object;
    midiInputs: Array<MIDIInput>;
    midiOutputs: Array<MIDIOutput>;
    connectedMIDIInputs: Array<MIDIInput>;
    addMIDIInput: Function;
    removeMIDIInput: Function;
    connectedMIDIOutputs: Array<MIDIOutput>;
    setConnectedMIDIOutputs: Function;
    addMIDIOutput: Function;
    removeMIDIOutput: Function;
    subscribe: Function;
}
declare function MIDIProvider(props: {
    children: React.ReactNode;
}): JSX.Element;
/**
 * @function useMIDI
 * @param {object} props
 * @param {int} [props.channel]
 * @param {int} [props.cc]
 * @param {MIDIOutput} [props.device]
 * @returns {object}
 */
declare function useMIDI(): MIDIActions;
declare function useMIDI(props: {
    channel?: number;
    cc?: number;
    device?: MIDIOutput;
}): MIDIActions;
declare function useMIDIOutput(requestedDevice: number | string): {
    device: MIDIOutput;
    sendMIDICC: Function;
    sendMIDIMessage: Function;
    sendMIDINoteOn: Function;
    sendMIDINoteOff: Function;
};
declare function useMIDIInput(requestedDevice: number | string): MIDIInput;
declare function useMIDIActions(device?: MIDIOutput): {
    sendMIDICC: Function;
    sendMIDIMessage: Function;
    sendMIDINoteOn: Function;
    sendMIDINoteOff: Function;
};
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
declare const index: {
    MIDIProvider: typeof MIDIProvider;
    useMIDI: typeof useMIDI;
    useMIDIInput: typeof useMIDIInput;
    useMIDIOutput: typeof useMIDIOutput;
    useMIDIActions: typeof useMIDIActions;
};
export default index;
export { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions };
