import React, {
  useMemo, createContext, useContext, useReducer, useCallback, useRef, useState, useEffect
} from 'react';

function translateTypeToStatusByte(type: string): number{
  switch(type){
    case('noteOff'): return 0x80;
    case('noteOn'): return 0x90;
    case('afterTouch'): return 0xA0;
    case('cc'): return 0xB0;
    case('controlChange'): return 0xB0;
    case('programChange'): return 0xC0;
    case('channelPressure'): return 0xD0;
    case('pitchWheel'): return 0xE0;
    default: return 0x00;
  }
};

export interface MIDICommand {
  channel: number;
  cc?: number ;
  value?: number;
  velocity?: number;
  pitch?: number;
  device?: WebMidi.MIDIOutput;
  type?: string;
  log?: boolean;
}

function sendMIDIMessage(props: MIDICommand): string {
  const {
    channel,
    cc,
    value,
    pitch,
    device,
    type='cc',
    log,
  } = props;

  const firstStatusByte = translateTypeToStatusByte(type);
  const statusBytes = firstStatusByte + (channel ?? 0);
  const msg = [statusBytes, pitch || (cc || 0), value || 0];
  if (device) {
    try{
      device.send(msg);
    }catch(error){
      if(log) console.warn(error);
      return 'an error occured.'
    }
    return `MIDI message successfully sent : ${msg}`;
  }
  return 'No device specified';
}

function onMIDIMessage(event:WebMidi.MIDIMessageEvent): { data: Uint8Array, timeStamp: number, str: string } {
  let str = '';
  for (let i = 0; i < event.data.length; i += 1) {
    str += `0x${event.data[i].toString(16)} `;
  }
  return { data: event.data, timeStamp: event.timeStamp, str };
}

interface openMIDIInputArgs{
  input:WebMidi.MIDIInput, 
  callback?:(args:{relVal:string, input:ReturnType<typeof onMIDIMessage>})=>void
}

async function openMIDIInput (props:openMIDIInputArgs): Promise<WebMidi.MIDIInput | Error> {
  const { input, callback } = props;
  if (typeof (input) !== 'object') return new Error('No input supplied');
  if (input.connection === 'open' && !callback) return input;
  input.onmidimessage = (msg:WebMidi.MIDIMessageEvent) => onMIDIMessage(msg);
  if (typeof (callback) === 'function') {
    const cb = (msg:WebMidi.MIDIMessageEvent) => {
      const message = onMIDIMessage(msg);
      const stateObj = { relVal: 'mostRecentMessage', input: message };
      callback(stateObj);
    };
    input.onmidimessage = (msg:WebMidi.MIDIMessageEvent) => cb(msg);
  }
  await input.open();
  return input;
}

/**
 * @description Closes and returns the input
 * @param {MIDIInput} input
 * @returns {MIDIInput}
 */
async function closeMIDIInput(input:WebMidi.MIDIInput): Promise<WebMidi.MIDIInput> {
  await input.close();
  return input;
}


interface MIDIContextValue {
}

const MIDIContext = createContext<MIDIContextValue>({} as MIDIContextValue);



function useStoreData() {
  const store:React.MutableRefObject<{
    byDevice:any,
    byChannel:any
}> = useRef({ byDevice: {}, byChannel: {} });

  const get = useCallback((props?:{channel?:number; cc?:number; device?:WebMidi.MIDIInput|WebMidi.MIDIOutput}) =>{
    if (!props) return store.current;
    const { channel, cc, device } = props;
    if (device) {
      return [...store.current.byDevice[device.id]].filter((record) => {
        if (channel && (record.channel !== channel)) return false;
        if (cc && (record.cc !== cc)) return false;
        return true;
      });
    }
    if(!channel) return store.current;
    if (!cc) return store.current.byChannel[channel];
    return store.current.byChannel[channel][cc];
  },[]);
  const set = useCallback((value:{channel:number, cc:number, value:number, device:WebMidi.MIDIPort}) => {
    store.current = {
      byChannel: {
        ...store.current.byChannel,
        [value.channel]: {
          ...store.current.byChannel[value.channel],
          [value.cc]: value.value,
        },
      },
      byDevice: {
        ...store.current.byDevice,
        [value.device.id]: {
          ...store.current.byDevice[value.device.id],
          [value.channel]: {
            ...store.current.byDevice[value.device.id]?.[value.channel],
            [value.cc]: value.value,
          },
        },
      },
    };
  },[]);
  const subscribers = useRef(new Set());

  const subscribe = useCallback((callback:Function) => {
    subscribers.current.add(callback);
    return () => subscribers.current.delete(callback);
  },[subscribers]);

  return {
    get,
    set,
    subscribe,
  };
}



function MIDIProvider(props:{children:React.ReactNode, onError:(err:Error)=>void}):JSX.Element {
  const { children, onError } = props;

  function reducer(state:Array<WebMidi.MIDIPort | WebMidi.MIDIInput | WebMidi.MIDIOutput>, action:any) {
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
  
  const [midiAccess, setMIDIAccess] = useState<WebMidi.MIDIAccess|null>(null);
  const [midiInputs, setMIDIInputs] = useState<WebMidi.MIDIInput[]>([]);
  const [midiOutputs, setMIDIOutputs] = useState<WebMidi.MIDIOutput[]>([]);
  useEffect(()=>{
    initializeMIDI(onError);
  }, [])
  const initializeMIDI = useCallback(async (onError:(err:Error)=>void)=>{
    try{
      if (!('requestMIDIAccess' in navigator)) throw new Error('MIDI is not supported in this browser.');
      const tempMidiAccess = await navigator.requestMIDIAccess();
      setMIDIAccess(()=>tempMidiAccess);
      setMIDIInputs(()=>([...tempMidiAccess.inputs].map((input) => (input[1]))));
      setMIDIOutputs(()=>([...tempMidiAccess.outputs].map((output) => (output[1]))));
    }catch(error){
      onError(error);
    }
  },[]);

  const addMIDIInput = useCallback(async (input: WebMidi.MIDIInput, callback?: openMIDIInputArgs['callback']):Promise<boolean> => {
    try {
      if(!midiAccess || !('inputs' in midiAccess)) throw new Error('inputs not available.');
      await openMIDIInput({input, callback});
      setConnectedMIDIInputs({ type: 'add', value: input });
      return true;
    } catch (error) {
      return false;
    }
  }, [midiInputs, midiAccess, connectedMIDIInputs]);

  const removeMIDIInput = useCallback((input:WebMidi.MIDIInput):boolean => {
    try {
      closeMIDIInput(input);
      setConnectedMIDIInputs({ type: 'remove', value: input });
      return true;
    } catch (error) {
      return false;
    }
  }, [midiInputs, midiAccess, connectedMIDIInputs]);

  const addMIDIOutput = useCallback((output:WebMidi.MIDIOutput) => {
    try {
      if(!midiAccess ||  !('outputs' in midiAccess)) throw new Error('outputs not available.')
      setConnectedMIDIOutputs({ type: 'add', value: output });
      return true;
    } catch (error) {
      return false;
    }
  }, [midiOutputs, midiAccess, connectedMIDIOutputs]);

  const removeMIDIOutput = useCallback((output:WebMidi.MIDIOutput) => {
    try {
      setConnectedMIDIOutputs({ type: 'remove', value: output });
      return true;
    } catch (error) {
      return false;
    }
  }, [midiOutputs, midiAccess, connectedMIDIOutputs]);

  const sendMIDICC = useCallback((args:{channel:number, cc:number, value:number, device:WebMidi.MIDIOutput}) => {
    const {
      channel, cc, value, device,
    } = args;
    if (typeof(channel) !== 'number') throw new Error(`no channel provided for cc. Expected a number and received ${channel}`);
    if (typeof(cc) !== 'number') throw new Error(`no cc# provided for cc. Expected a number and received ${cc}`);
    if (typeof(value) !=='number') throw new Error(`no value provided for cc. Expected a number and received ${value}`);
    if (!device) throw new Error(`no device provided for cc. Expected a MIDIOutputDevice and recieved ${device}`);
    sendMIDIMessage({
      channel, cc, value, device, type: 'cc',
    });
    setMIDIValue({
      channel, cc, value, device,
    });
  }, [connectedMIDIOutputs, sendMIDIMessage]);

  const sendMIDINoteOn = useCallback((args:{channel:number, pitch:number, value?:number, velocity?:number, device:WebMidi.MIDIOutput}) => {
    const {
      channel, pitch, value, device, velocity,
    } = args;
    if (typeof(channel) !== 'number') throw new Error(`no channel provided for noteOn. Expected a number and received ${channel}`);
    if (typeof(pitch) !== 'number') throw new Error(`no pitch provided for noteOn. Expected a number and received ${pitch}`);
    if (typeof(velocity) !== 'number' && typeof(value) !== 'number') throw new Error(`no value/velocity provided for noteOn. Expected a number and received ${velocity ?? value}`);
    if (!device) throw new Error(`no device provided for noteOn. Expected a MIDIOutputDevice and recieved ${device}`);
    sendMIDIMessage({
      channel, pitch, value: value ?? velocity, device, type: 'noteOn',
    });
  }, [connectedMIDIOutputs, sendMIDIMessage]);

  const sendMIDINoteOff = useCallback((args:{channel:number, pitch:number, device:WebMidi.MIDIOutput}) => {
    const {
      channel, pitch, device,
    } = args;
    if (typeof(channel) !== 'number') throw new Error(`no channel provided for noteOff. Expected a number and received ${channel}`);
    if (typeof(pitch) !== 'number') throw new Error(`no pitch provided for noteOff. Expected a number and received ${pitch}`);
    if (!device) throw new Error(`no device provided for noteOff. Expected a MIDIOutputDevice and received ${device}`);
    sendMIDIMessage({
      channel, pitch, value: 0, device, type: 'noteOff',
    });
  }, [connectedMIDIOutputs, sendMIDIMessage]);

  interface MIDIContextValue {
    initializeMIDI: (onError:(err:Error)=>void) =>void;
    openMIDIInput: (args:openMIDIInputArgs) => Promise<WebMidi.MIDIInput|Error>;
    onMIDIMessage: (message:WebMidi.MIDIMessageEvent) => void;
    getMIDIValue: (args:MIDICommand) => number;
    sendMIDIMessage: (args:MIDICommand) => void;
    sendMIDICC: (args:MIDICommand) => void;
    sendMIDINoteOn: (args:{channel:number, pitch:number, value?:number, velocity?:number, device:WebMidi.MIDIOutput}) => void;
    sendMIDINoteOff: (args:{channel:number, pitch:number, device:WebMidi.MIDIOutput}) => void;
    midiAccess:WebMidi.MIDIAccess|null;
    midiInputs:WebMidi.MIDIInput[];
    midiOutputs:WebMidi.MIDIOutput[];
    connectedMIDIInputs:WebMidi.MIDIInput[];
    addMIDIInput: (input: WebMidi.MIDIInput, callback?: openMIDIInputArgs['callback']) => Promise<boolean>;
    removeMIDIInput: (input:WebMidi.MIDIInput) => boolean;
    connectedMIDIOutputs:WebMidi.MIDIOutput[];
    setConnectedMIDIOutputs: (outputs:WebMidi.MIDIOutput[]) => void;
    addMIDIOutput: (output:WebMidi.MIDIOutput) => boolean;
    removeMIDIOutput: (output:WebMidi.MIDIOutput) => boolean;
    subscribe: (fn:Function) => void;
  }


  const value = useMemo(():MIDIContextValue => ({
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
  return (
    <MIDIContext.Provider value={value}>
      {children}
    </MIDIContext.Provider>
  );
}

type SelectorFunction<R> = (state: MIDIContextValue) => R;

function useMIDIContext<R>(selector: SelectorFunction<R>): R {
  const latestSelectedStateRef = useRef<R>();
  const latestSelectedResultRef = useRef<R>();

  const valueFromContext = useContext(MIDIContext);
  const selectedState = selector(valueFromContext);

  if (selectedState !== latestSelectedStateRef.current) {
    latestSelectedStateRef.current = selectedState;
    latestSelectedResultRef.current = selectedState;
  }

  return latestSelectedResultRef.current!;
}

interface MIDIContextValue {
  initializeMIDI: (onError:(err:Error)=>void) =>void;
  openMIDIInput: (args:openMIDIInputArgs) => Promise<WebMidi.MIDIInput|Error>;
  onMIDIMessage: (message:WebMidi.MIDIMessageEvent) => void;
  getMIDIValue: (args:MIDICommand) => number;
  sendMIDIMessage: (args:MIDICommand) => void;
  sendMIDICC: (args:MIDICommand) => void;
  sendMIDINoteOn: (args:MIDICommand) => void;
  sendMIDINoteOff: (args:MIDICommand) => void;
  midiAccess:WebMidi.MIDIAccess|null;
  midiInputs:WebMidi.MIDIInput[];
  midiOutputs:WebMidi.MIDIOutput[];
  connectedMIDIInputs:WebMidi.MIDIInput[];
  addMIDIInput: (input: WebMidi.MIDIInput, callback?: openMIDIInputArgs['callback']) => Promise<boolean>;
  removeMIDIInput: (input:WebMidi.MIDIInput) => boolean;
  connectedMIDIOutputs:WebMidi.MIDIOutput[];
  setConnectedMIDIOutputs: (outputs:WebMidi.MIDIOutput[]) => void;
  addMIDIOutput: (output:WebMidi.MIDIOutput) => boolean;
  removeMIDIOutput: (output:WebMidi.MIDIOutput) => boolean;
  subscribe: (fn:Function) => void;
}



function useMIDI():MIDIContextValue;
function useMIDI(props:{channel?:number, cc?:number, device?:WebMidi.MIDIOutput}):{sendMIDIMessage:(value:number)=>void};

function useMIDI(props?:{channel?:number, cc?:number, device?:WebMidi.MIDIOutput}){
  const { channel, cc, device } = props ?? {};
  if(typeof(channel) == 'number' && typeof(cc) == 'number'){
    
    const send = (value:number) => {
      sendMIDIMessage({
        channel, cc, value, device, type:'cc'
      });
    };
    return {
      sendMIDIMessage: send,
    };
  }
  return useMIDIContext((cv)=>cv);
}

function useMIDIOutput(requestedDevice: number | string){
  const midiOutputs = useMIDIContext((cv)=>cv.midiOutputs);
  const sendMIDICC = useMIDIContext((cv)=>cv.sendMIDICC);
  const sendMIDIMessage = useMIDIContext((cv)=>cv.sendMIDIMessage);
  const sendMIDINoteOn = useMIDIContext((cv)=>cv.sendMIDINoteOn);
  const sendMIDINoteOff = useMIDIContext((cv)=>cv.sendMIDINoteOff);

  let device = (typeof (requestedDevice) == 'number') 
    ? midiOutputs[requestedDevice] 
    : midiOutputs.filter((device)=>(device.name === requestedDevice))[0];
  if(!device) {
    return {
      device, 
      sendMIDICC:()=>{}, 
      sendMIDIMessage:()=>{}, 
      sendMIDINoteOn:()=>{}, 
      sendMIDINoteOff:()=>{}
    }
  };
  return {
    device,
    sendMIDICC:(command:MIDICommand)=>{
      sendMIDICC({device, ...command});
    },
    sendMIDIMessage:(command:MIDICommand)=>{
      sendMIDIMessage({device, ...command});
    },
    sendMIDINoteOn:(command:MIDICommand)=>{
      sendMIDINoteOn({device, ...command});
    },
    sendMIDINoteOff:(command:MIDICommand)=>{
      sendMIDINoteOff({device, ...command});
    },
  }
}

function useMIDIInput(requestedDevice: number | string){
  const midiInputs = useMIDIContext(cv=>cv.midiInputs);
  let device:WebMidi.MIDIInput;
  try{

    if(typeof (requestedDevice) == 'number'){
      device = midiInputs[requestedDevice];
    }
    else{
      device = midiInputs.filter((device:WebMidi.MIDIInput)=>(device.name === requestedDevice))[0];
    }
    if(!('connection' in device)) throw new Error('no device');
    if(device.connection == 'closed') device.open();
    return device;
  }catch(err){
    return null;
  }
}

function useMIDIActions(device?:WebMidi.MIDIOutput){
  const sendMIDICC = useMIDIContext((cv)=>cv.sendMIDICC);
  const sendMIDIMessage = useMIDIContext((cv)=>cv.sendMIDIMessage);
  const sendMIDINoteOn = useMIDIContext((cv)=>cv.sendMIDINoteOn);
  const sendMIDINoteOff = useMIDIContext((cv)=>cv.sendMIDINoteOff);

  if(!device){
    return {sendMIDICC, sendMIDIMessage, sendMIDINoteOn, sendMIDINoteOff};
  }
  return {
    sendMIDICC:(command:MIDICommand)=>{
      sendMIDICC({device, ...command});
    },
    sendMIDIMessage:(command:MIDICommand)=>{
      sendMIDIMessage({device, ...command});
    },
    sendMIDINoteOn:(command:MIDICommand)=>{
      sendMIDINoteOn({device, ...command});
    },
    sendMIDINoteOff:(command:MIDICommand)=>{
      sendMIDINoteOff({device, ...command});
    },
  }
}

const index = { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions, useMIDIContext };

export default index;

export { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions, useMIDIContext };
