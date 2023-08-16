/// <reference types="webmidi" />
import React from 'react';
export interface MIDICommand {
    channel: number;
    cc?: number;
    value?: number;
    velocity?: number;
    pitch?: number;
    device?: WebMidi.MIDIOutput;
    type?: string;
    log?: boolean;
}
declare function onMIDIMessage(event: WebMidi.MIDIMessageEvent): {
    data: Uint8Array;
    timeStamp: number;
    str: string;
};
interface openMIDIInputArgs {
    input: WebMidi.MIDIInput;
    callback?: (args: {
        relVal: string;
        input: ReturnType<typeof onMIDIMessage>;
    }) => void;
}
interface MIDIContextValue {
}
declare function MIDIProvider(props: {
    children: React.ReactNode;
    onError: (err: Error) => void;
}): JSX.Element;
type SelectorFunction<R> = (state: MIDIContextValue) => R;
declare function useMIDIContext<R>(selector: SelectorFunction<R>): R;
interface MIDIContextValue {
    initializeMIDI: (onError: (err: Error) => void) => void;
    openMIDIInput: (args: openMIDIInputArgs) => Promise<WebMidi.MIDIInput | Error>;
    onMIDIMessage: (message: WebMidi.MIDIMessageEvent) => void;
    getMIDIValue: (args: MIDICommand) => number;
    sendMIDIMessage: (args: MIDICommand) => void;
    sendMIDICC: (args: MIDICommand) => void;
    sendMIDINoteOn: (args: MIDICommand) => void;
    sendMIDINoteOff: (args: MIDICommand) => void;
    midiAccess: WebMidi.MIDIAccess | null;
    midiInputs: WebMidi.MIDIInput[];
    midiOutputs: WebMidi.MIDIOutput[];
    connectedMIDIInputs: WebMidi.MIDIInput[];
    addMIDIInput: (input: WebMidi.MIDIInput, callback?: openMIDIInputArgs['callback']) => Promise<boolean>;
    removeMIDIInput: (input: WebMidi.MIDIInput) => boolean;
    connectedMIDIOutputs: WebMidi.MIDIOutput[];
    setConnectedMIDIOutputs: (outputs: WebMidi.MIDIOutput[]) => void;
    addMIDIOutput: (output: WebMidi.MIDIOutput) => boolean;
    removeMIDIOutput: (output: WebMidi.MIDIOutput) => boolean;
    subscribe: (fn: Function) => void;
}
declare function useMIDI(): MIDIContextValue;
declare function useMIDI(props: {
    channel?: number;
    cc?: number;
    device?: WebMidi.MIDIOutput;
}): {
    sendMIDIMessage: (value: number) => void;
};
declare function useMIDIOutput(requestedDevice: number | string): {
    device: WebMidi.MIDIOutput;
    sendMIDICC: (command: MIDICommand) => void;
    sendMIDIMessage: (command: MIDICommand) => void;
    sendMIDINoteOn: (command: MIDICommand) => void;
    sendMIDINoteOff: (command: MIDICommand) => void;
};
declare function useMIDIInput(requestedDevice: number | string): WebMidi.MIDIInput | null;
declare function useMIDIActions(device?: WebMidi.MIDIOutput): {
    sendMIDICC: (args: MIDICommand) => void;
    sendMIDIMessage: (args: MIDICommand) => void;
    sendMIDINoteOn: (args: MIDICommand) => void;
    sendMIDINoteOff: (args: MIDICommand) => void;
};
declare const index: {
    MIDIProvider: typeof MIDIProvider;
    useMIDI: typeof useMIDI;
    useMIDIInput: typeof useMIDIInput;
    useMIDIOutput: typeof useMIDIOutput;
    useMIDIActions: typeof useMIDIActions;
    useMIDIContext: typeof useMIDIContext;
};
export default index;
export { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions, useMIDIContext };
