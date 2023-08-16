## react-midi-context

A React component for working with MIDI devices and sending MIDI messages.

### Installation

```
npm install react-midi-context
```

### Usage

Import the `MIDIProvider` component and wrap it around your app to provide MIDI functionality to your components:

```jsx
import { MIDIProvider } from 'react-midi-context';

function App() {
  return (
    <MIDIProvider>
      {/* Your app components */}
    </MIDIProvider>
  );
}
```

### MIDIProvider API

The `MIDIProvider` component provides the following API through the `MIDIContext` context:

- `initializeMIDI`: Initializes the MIDI functionality and returns an object with MIDI inputs and outputs.
- `openMIDIInput(input, callback)`: Opens a MIDI input for receiving MIDI messages.
- `onMIDIMessage(event)`: Handles a MIDI input event and returns an object with the MIDI data.
- `sendMIDIMessage(props)`: Sends a MIDI message with the specified properties.
- `sendMIDICC(channel, cc, value, device)`: Sends a MIDI Control Change (CC) message.
- `sendMIDINoteOn(channel, pitch, value/velocity, device)`: Sends a MIDI Note On message.
- `sendMIDINoteOff(channel, pitch, value/velocity, device)`: Sends a MIDI Note Off message.
- `getMIDIValue({channel, cc, device})`: Retrieves the stored value for a MIDI channel and control change (CC) number.
- `midiAccess`: The MIDI access object.
- `midiInputs`: An array of available MIDI inputs.
- `midiOutputs`: An array of available MIDI outputs.
- `connectedMIDIInputs`: An array of currently connected MIDI inputs.
- `addMIDIInput(input, callback)`: Adds a MIDI input and opens it for receiving MIDI messages.
- `removeMIDIInput(input)`: Removes a MIDI input and closes it.
- `connectedMIDIOutputs`: An array of currently connected MIDI outputs.
- `addMIDIOutput(output)`: Adds a MIDI output.
- `removeMIDIOutput(output)`: Removes a MIDI output.
- `subscribe(callback)`: Subscribes to changes in the MIDI context.

### Examples

Send a MIDI Control Change (CC) message:

```jsx
import { useMIDIContext } from 'react-midi-context';

function MyComponent() {
  const { sendMIDICC } = useMIDIContext();

  const handleButtonClick = () => {
    sendMIDICC(1, 64, 127, outputDevice);
  };

  return (
    <button onClick={handleButtonClick}>Send MIDI CC</button>
  );
}
```

Open a MIDI input and handle incoming MIDI messages:

```jsx
import { useMIDIContext } from 'react-midi-context';

function MyComponent() {
  const { openMIDIInput, onMIDIMessage } = useMIDIContext();

  useEffect(() => {
    const handleMIDIMessage = (event) => {
      const { data, timeStamp, str } = onMIDIMessage(event);
      // Handle the MIDI message
    };

    const openInput = async () => {
      const input = await openMIDIInput(inputDevice);
      if (input) {
        input.onmidimessage = handleMIDIMessage;
      }
    };

    openInput();

    return () => {
      // Clean up the input
    };
  }, []);

  return (
    // Your component JSX
  );
}
```

### License

This project is licensed under the ISC License.