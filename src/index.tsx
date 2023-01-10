/**
 * @module MIDIContext
 */

import React, {
  useMemo, createContext, useContext, useReducer, useCallback, useRef, useState, useEffect
} from 'react';

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

function translateTypeToStatusByte(type: string): number{
  switch(type){
    case('noteOff'): return 0x80;
    case('noteOn'): return 0x90;
    case('afterTouch'): 0xA0;
    case('cc'): return 0xB0;
    case('controlChange'): return 0xB0;
    case('programChange'): return 0xC0;
    case('channelPressure'): return 0xD0;
    case('pitchWheel'): return 0xE0;
    default: return 0x00;
  }
};

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

export interface MIDIPort{
  connection: string;
  id: string;
  manufacturer: string;
  onstatechange?: Function;
  name?: string;
  state: string;
  type: string;
  version: string;
}

export interface MIDIOutput extends MIDIPort{
  send: Function;
}



export interface MIDICommand {
  channel?: number;
  cc?: number ;
  value?: number;
  velocity?: number;
  pitch?: number;
  device?: MIDIOutput | MIDIOutput[];
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
    if (device.constructor === Array) {
      device.forEach((d) => d?.send(msg));
      return `messages sent successfully to multiple outputs : ${msg}`;
    }
    if(!Array.isArray(device)){
      try{
        device.send(msg);
      }catch(error){
        if(log) console.warn(error);
        return 'an error occured.'
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
function onMIDIMessage(event:Event|any): object {
  let str = '';
  for (let i = 0; i < event.data.length; i += 1) {
    str += `0x${event.data[i].toString(16)} `;
  }
  return { data: event.data, timeStamp: event.timeStamp, str };
}

/**
 * @param {MIDIInput} props.input - an input from the MIDIAccess object
 * @returns {MIDIInput}
 */

export interface MIDIInput extends MIDIPort{
  onmidimessage?: Function;
  open: Function;
  close: Function;
}
async function openMIDIInput (props:{input:MIDIInput, callback?:Function}): Promise<MIDIInput | Error> {
  const { input, callback } = props;
  if (typeof (input) !== 'object') return new Error('No input supplied');
  if (input.connection === 'open' && !callback) return input;
  input.onmidimessage = (msg:Event) => onMIDIMessage(msg);
  if (typeof (callback) === 'function') {
    const cb = (msg:Event) => {
      const message = onMIDIMessage(msg);
      const stateObj = { relVal: 'mostRecentMessage', input: message };
      callback(stateObj);
    };
    input.onmidimessage = (msg:Event) => cb(msg);
  }
  await input.open();
  return input;
}

/**
 * @description Closes and returns the input
 * @param {MIDIInput} input
 * @returns {MIDIInput}
 */
async function closeMIDIInput(input:MIDIInput): Promise<MIDIInput> {
  await input.close();
  return input;
}


export interface MIDIActions {
  initializeMIDI:Function;
  openMIDIInput:Function;
  onMIDIMessage:Function;
  sendMIDIMessage:Function;
  sendMIDICC:Function;
  sendMIDINoteOn:Function;
  sendMIDINoteOff:Function;
  getMIDIValue:Function;
  midiAccess:Object;
  midiInputs:Array<MIDIInput>;
  midiOutputs:Array<MIDIOutput>;
  connectedMIDIInputs:Array<MIDIInput>;
  addMIDIInput:Function;
  removeMIDIInput:Function;
  connectedMIDIOutputs:Array<MIDIOutput>;
  setConnectedMIDIOutputs:Function;
  addMIDIOutput:Function;
  removeMIDIOutput:Function;
  subscribe:Function
}

const MIDIContext:React.Context<any> = createContext({
  initializeMIDI:function(){},
  openMIDIInput:function(){},
  onMIDIMessage:function(){},
  sendMIDIMessage:function(){},
  sendMIDICC:function(){},
  sendMIDINoteOn:function(){},
  sendMIDINoteOff:function(){},
  midiAccess:{},
  midiInputs:[],
  midiOutputs:[],
  connectedMIDIInputs:[],
  addMIDIInput:function(){},
  removeMIDIInput:function(){},
  connectedMIDIOutputs:[],
  setConnectedMIDIOutputs:function(){},
  addMIDIOutput:function(){},
  removeMIDIOutput:function(){},
});



function useStoreData() {
  const store:React.MutableRefObject<{
    byDevice:any,
    byChannel:any
}> = useRef({ byDevice: {}, byChannel: {} });

  const get = useCallback((props?:{channel?:number; cc?:number; device?:MIDIInput|MIDIOutput}) =>{
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
  const set = useCallback((value:{channel:number, cc:number, value:number, device:MIDIPort}) => {
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


function MIDIProvider(props:{children:React.ReactNode}):JSX.Element {
  const { children } = props;

  function reducer(state:Array<MIDIPort | MIDIInput | MIDIOutput>, action:any) {
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
  useEffect(()=>{
    initializeMIDI();
  }, [])

  /**
 * @function initializeMIDI
 * @returns {object} an object with midi inputs and outputs
 */ 

async function initializeMIDI():Promise<{midiAccess:any; midiInputs:Array<MIDIInput>; midiOutputs:Array<MIDIOutput>}> {
  if (!('requestMIDIAccess' in navigator)) return Promise.reject(new Error('MIDI is not supported in this browser.'));
  //@ts-ignore
  const tempMidiAccess = await navigator.requestMIDIAccess();
  setMIDIAccess(()=>tempMidiAccess);
  const tmpInputs = [...tempMidiAccess.inputs].map((input) => (input[1]))
  //@ts-ignore
  setMIDIInputs(()=>tmpInputs);
  const tmpOutputs = [...tempMidiAccess.outputs].map((output) => (output[1]))
  //@ts-ignore
  setMIDIOutputs(()=>tmpOutputs);
  return { midiAccess, midiInputs, midiOutputs };
}


  /**
   * @function addMIDIInput
   * @param {MIDIInput} input - the input to add
   */
  const addMIDIInput = useCallback((input: MIDIInput, callback?: Function):boolean => {
    try {
      if(!('inputs' in midiAccess)) throw new Error('inputs not available.');
      openMIDIInput({input, callback});
      setConnectedMIDIInputs({ type: 'add', value: input });
      return true;
    } catch (error) {
      return false;
    }
  }, [connectedMIDIInputs]);

  /**
   * @function removeMIDIInput
   * @param {MIDIInput} input - the input to remove
   */

  const removeMIDIInput = useCallback((input:MIDIInput):boolean => {
    try {
      closeMIDIInput(input);
      setConnectedMIDIInputs({ type: 'remove', value: input });
      return true;
    } catch (error) {
      return false;
    }
  }, [connectedMIDIInputs]);

  /**
   * @function addMIDIOutput
   * @param {MIDIOutput} output - the output to add
   */

  const addMIDIOutput = useCallback((output:MIDIOutput) => {
    try {
      if(!('outputs' in midiAccess)) throw new Error('outputs not available.')
      setConnectedMIDIOutputs({ type: 'add', value: output });
      return true;
    } catch (error) {
      return false;
    }
  }, [connectedMIDIOutputs]);

  /**
   * @function removeMIDIOutput
   * @param {MIDIOutput} output - the output to remove
   */

  const removeMIDIOutput = useCallback((output:MIDIOutput) => {
    try {
      setConnectedMIDIOutputs({ type: 'remove', value: output });
      return true;
    } catch (error) {
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

  const sendMIDICC = useCallback((args:{channel:number, cc:number, value:number, device:MIDIOutput}) => {
    const {
      channel, cc, value, device,
    } = args;
    if (!channel) throw new Error(`no channel provided for cc. Expected a number and received ${channel}`);
    if (!cc) throw new Error(`no cc# provided for cc. Expected a number and received ${cc}`);
    if (!device) throw new Error(`no device provided for cc. Expected a MIDIOutputDevice and recieved ${device}`);
    if (!(value)) throw new Error(`no value provided for noteOn. Expected a number and received ${value}`);
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

  const sendMIDINoteOn = useCallback((args:{channel:number, pitch:number, value?:number, velocity?:number, device:MIDIOutput}) => {
    const {
      channel, pitch, value, device, velocity,
    } = args;
    if (!channel) throw new Error(`no channel provided for noteOn. Expected a number and received ${channel}`);
    if (!pitch) throw new Error(`no pitch provided for noteOn. Expected a number and received ${pitch}`);
    if (!device) throw new Error(`no device provided for noteOn. Expected a MIDIOutputDevice and recieved ${device}`);
    if (!(velocity || value)) throw new Error(`no value/velocity provided for noteOn. Expected a number and received ${velocity ?? value}`);
    sendMIDIMessage({
      channel, pitch, value: value ?? velocity, device, type: 'noteOn',
    });
  }, [connectedMIDIOutputs, sendMIDIMessage]);

  /**
   * @function sendMIDINoteOff
   * @param {number} args.channel - the channel to send the command on
   * @param {number} args.pitch - the pitch to send
   * @param {MIDIOutput} args.device - the device to send the command on
   */
  const sendMIDINoteOff = useCallback((args:{channel:number, pitch:number, device:MIDIOutput}) => {
    const {
      channel, pitch, device,
    } = args;
    if (!channel) throw new Error(`no channel provided for noteOff. Expected a number and received ${channel}`);
    if (!pitch) throw new Error(`no pitch provided for noteOff. Expected a number and received ${pitch}`);
    if (!device) throw new Error(`no device provided for noteOff. Expected a MIDIOutputDevice and received ${device}`);
    sendMIDIMessage({
      channel, pitch, value: 0, device, type: 'noteOff',
    });
  }, [connectedMIDIOutputs, sendMIDIMessage]);
  const value = useMemo(():MIDIActions => ({
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
  return (
    <MIDIContext.Provider value={value}>
      {children}
    </MIDIContext.Provider>
  );
}

function useMIDIContext():{
  initializeMIDI:Function,
  openMIDIInput:Function,
  onMIDIMessage:Function,
  sendMIDIMessage:Function,
  sendMIDICC:Function,
  sendMIDINoteOn:Function,
  sendMIDINoteOff:Function,
  midiAccess:Object,
  midiInputs:Array<MIDIInput>,
  midiOutputs:Array<MIDIOutput>,
  connectedMIDIInputs:Array<MIDIInput>,
  connectedMIDIOutputs:Array<MIDIOutput>,
  addMIDIInput:Function,
  removeMIDIInput:Function,
  setConnectedMIDIOutputs:Function,
  addMIDIOutput:Function,
  removeMIDIOutput:Function,
  subscribe:Function,}{
  return useContext(MIDIContext)
}


/**
 * @function useMIDI
 * @param {object} props
 * @param {int} [props.channel]
 * @param {int} [props.cc]
 * @param {MIDIOutput} [props.device]
 * @returns {object}
 */

function useMIDI():MIDIActions;
function useMIDI(props:{channel?:number, cc?:number, device?:MIDIOutput}): MIDIActions

function useMIDI(props?:{channel?:number, cc?:number, device?:MIDIOutput}){
  if (!props || !('channel' in props && 'cc' in props && 'device' in props)) return useMIDIContext();
  const { channel, cc, device } = props;
  const send = (value:number) => {
    sendMIDIMessage({
      channel, cc, value, device, type:'cc'
    });
  };
  return {
    sendMIDIMessage: send,
  };
}

function useMIDIOutput(requestedDevice: number | string):{device:MIDIOutput, sendMIDICC:Function, sendMIDIMessage:Function, sendMIDINoteOn:Function, sendMIDINoteOff:Function}{
  const {midiOutputs, sendMIDICC, sendMIDIMessage, sendMIDINoteOn, sendMIDINoteOff} = useMIDIContext();
  let device:MIDIOutput;
  if (typeof (requestedDevice) == 'number') device = midiOutputs[requestedDevice];
  else device = midiOutputs.filter((device:MIDIOutput)=>(device.name === requestedDevice))[0];
  if(typeof(device) === 'undefined') {
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

function useMIDIInput(requestedDevice: number | string):MIDIInput{
  const {midiInputs} = useMIDIContext();
  let device:MIDIInput;
  try{

    if(typeof (requestedDevice) == 'number'){
      device = midiInputs[requestedDevice];
    }
    else{
      device = midiInputs.filter((device:MIDIInput)=>(device.name === requestedDevice))[0];
    }
    if(!('connection' in device)) throw new Error('no device');
    if(device.connection == 'closed') device.open();
    return device;
  }catch(err){
    return {
      connection: 'disconnected',
      id: 'err',
      manufacturer: 'err',
      name: 'err',
      state: 'disconnected',
      type: 'output',
      open:()=>{},
      close:()=>{},
      version: '0',
    }
  }
}

function useMIDIActions(device?:MIDIOutput):{sendMIDICC:Function, sendMIDIMessage:Function, sendMIDINoteOn:Function, sendMIDINoteOff:Function}{
  const {sendMIDICC, sendMIDIMessage, sendMIDINoteOn, sendMIDINoteOff} = useMIDIContext();
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

export default index;

export { MIDIProvider, useMIDI, useMIDIInput, useMIDIOutput, useMIDIActions };
