# React MIDI Context

## Description

This library includes a [MIDIProvider](#setting-up-the-midiprovider) component, [four hooks](#available-hooks),  [thirteen functions](#available-functions), and access to the [raw MIDI ports](#accessing-devices-directly), providing you with the flexibility to use MIDI
in your React application in whatever way suits your needs.

---

## Getting started

### Installation

 Enter `npm i react-midi-context` in your console to install.

### Setting up the MIDIProvider

1. Import the `MIDIProvider` component to your main.js file with `import {MIDIProvider} from 'react-midi-context'`.

2. Wrap your `<App>` component in the `<MIDIProvider>` component.

3. That's it, you're all set!

---

## Available hooks

### useMIDI

### useMIDIActions

### useMIDIOutput

### useMIDIInput

---

## Available functions

### initializeMIDI

### sendMIDICC

### sendMIDINoteOn

### sendMIDINoteOff

### setMIDIValue

---

### Accessing devices directly
