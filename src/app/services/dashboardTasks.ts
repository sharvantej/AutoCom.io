import type { Connection, TaskEntry } from "../types";

export type TaskCatalogue = {
  modes: string[];
  categories: Record<string, string[]>;
};

function isTaskParams(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inferShortcutAction(
  params: Record<string, unknown>,
  connection: Connection,
): string {
  const explicitAction = typeof params.action === "string" ? params.action.trim() : "";
  if (explicitAction) return explicitAction;

  const protocol = typeof params.protocol === "string"
    ? params.protocol.trim().toLowerCase()
    : String(connection.protocol ?? "").trim().toLowerCase();

  if (protocol === "osc" || typeof params.address === "string" || Array.isArray(params.args)) {
    return "osc";
  }
  if (
    protocol === "http" ||
    protocol === "https" ||
    typeof params.method === "string" ||
    typeof params.path === "string"
  ) {
    return "http";
  }
  return "command";
}

function buildShortcutRow(task: TaskEntry, connection: Connection): Record<string, unknown> {
  const params = isTaskParams(task.params) ? { ...task.params } : {};

  return {
    kind: "task",
    id: task.id,
    connectionId: connection.id,
    device: connection.name,
    deviceName: connection.name,
    deviceType: connection.device,
    action: inferShortcutAction(params, connection),
    params,
  };
}

const DEFAULT_CATALOGUE: TaskCatalogue = {
  modes: ["Direct", "Toggle"],
  categories: {
    General: ["Execute", "Toggle", "Trigger"],
  },
};

const STANDARD_CATALOGUES: Record<string, TaskCatalogue> = {
  atem: {
    modes: ["Direct"],
    categories: {
      "Aux/Output": [
        "Aux/Output: Set source",
      ],
      "Downstream key": [
        "Downstream key: Run AUTO Transition",
        "Downstream key: Set inputs",
        "Downstream key: Set Mask",
        "Downstream key: Set OnAir",
        "Downstream key: Set Pre Multiplied Key",
        "Downstream key: Set Rate",
        "Downstream key: Set Tied",
      ],
      "Fade to black": [
        "Fade to black: Change rate",
        "Fade to black: Run AUTO Transition",
      ],
      Input: [
        "Input: Set name",
      ],
      Macro: [
        "Macro: Continue",
        "Macro: Loop",
        "Macro: Run",
        "Macro: Stop",
      ],
      ME: [
        "ME: Perform AUTO transition",
        "ME: Perform CUT transition",
        "ME: Set Preview input",
        "ME: Set Program input",
        "ME: Set TBar position",
      ],
      "Media player": [
        "Media player: Capture still",
        "Media player: Cycle source",
        "Media player: Delete still",
        "Media player: Set source",
      ],
      Multiviewer: [
        "Multiviewer: Change layout",
        "Multiviewer: Change window source",
      ],
      "Startup State": [
        "Startup State: Clear",
        "Startup State: Save",
      ],
      Transition: [
        "Transition: Change rate",
        "Transition: Change selection",
        "Transition: Change selection component",
        "Transition: Preview",
        "Transition: Select components in transition",
        "Transition: Set style/pattern",
      ],
      "Upstream key": [
        "Upstream key: Set Flying Key (Luma, Chroma, Pattern)",
        "Upstream key: Set inputs",
        "Upstream key: Set Mask (Luma, Chroma, Pattern)",
        "Upstream key: Set OnAir",
        "Upstream key: Set type",
      ],
    },
  },
  vmix: {
    modes: ["Direct", "Toggle", "Momentary", "Delayed"],
    categories: {
      Transition: ["Cut", "Fade", "Stinger1", "Stinger2", "Wipe", "Zoom"],
      Recording: ["Start", "Stop", "Pause"],
      Streaming: ["Start", "Stop"],
      Audio: ["AudioOn", "AudioOff", "AudioBus", "Master"],
      Video: ["CutInput1", "CutInput2", "CutInput3", "CutInput4"],
    },
  },
  obs: {
    modes: ["Direct", "Toggle"],
    categories: {
      "Recording & Streaming & Outputs": [
        "Toggle Recording",
        "Start Recording",
        "Stop Recording",
        "Toggle Recording Pause",
        "Pause Recording",
        "Resume Recording",
        "Split Recording",
        "Create Record Chapter",
        "Start Streaming",
        "Stop Streaming",
        "Toggle Streaming",
        "Set Stream Settings",
        "Send Stream Caption",
        "Start Output",
        "Stop Output",
        "Toggle Output",
        "Start Replay Buffer",
        "Stop Replay Buffer",
        "Toggle Replay Buffer",
        "Save Replay Buffer",
      ],
      "Switching & Transitions": [
        "Set Program Scene",
        "Set Preview Scene",
        "Preview Next Scene",
        "Preview Previous Scene",
        "Smart Scene Switcher",
        "Transition",
        "Quick Transition",
        "Set Transition Type",
        "Set Transition Duration",
        "Adjust Transition Duration",
        "Adjust Transition Type",
      ],
      Sources: [
        "Set Source Visibility",
        "Set Filter Visibility",
        "Set Filter Settings",
        "Set Source Transform",
        "Set Source Mute",
        "Toggle Source Mute",
        "Set Source Volume",
        "Adjust Source Volume (dB)",
        "Adjust Source Volume (Percentage)",
        "Fade Source Volume",
        "Set Audio Monitor",
        "Set Audio Sync Offset",
        "Adjust Audio Sync Offset",
        "Set Audio Balance",
        "Adjust Audio Balance",
        "Set Source Text",
        "Set Text Properties",
        "Refresh Browser Source",
        "Reset Video Capture Device",
        "Play / Pause Media",
        "Restart Media",
        "Stop Media",
        "Next Media",
        "Previous Media",
        "Set Media Time",
        "Scrub Media",
        "Update Media Source Local File Path",
        "Open Source Properties Window",
        "Open Source Filters Window",
        "Open Source Interact Window",
      ],
      General: [
        "Enable Studio Mode",
        "Disable Studio Mode",
        "Toggle Studio Mode",
        "Open Projector",
        "Set Profile",
        "Set Scene Collection",
        "Take Screenshot",
        "Trigger Hotkey by ID",
        "Trigger Hotkey by Key",
        "Custom Command",
        "Custom Vendor Request",
      ],
    },
  },
  grandma3: {
    modes: ["Direct"],
    categories: {
      Commands: [
        "At Menu",
        "Call Macro via name",
        "Call Macro via number",
        "Call Plugin via name",
        "Call Plugin via number",
        "Executor Button",
        "Run Command",
        "Select Group via name",
        "Select Group via number",
        "Select MAtrick via name",
        "Select MAtrick via number",
        "Select Quickey via name",
        "Select Quickey via number",
        "Select Sequence via name",
        "Select Sequence via number",
      ],
    },
  },
  grandma2: {
    modes: ["Direct"],
    categories: {
      Commands: [
        "Button Press/Release",
        "Encoder Press/Release",
        "Move wheel up/down",
        "Rotate Encoder",
        "Run Custom Command",
      ],
    },
  },
  resolume: {
    modes: ["Direct"],
    categories: {
      Composition: [
        "Composition Master Change",
        "Composition Opacity Change",
        "Composition Speed Change",
        "Composition Volume Change",
        "Composition Next Column",
        "Composition Previous Column",
        "Tap Tempo",
        "Resync Tempo",
      ],
      Clip: [
        "Trigger Clip",
        "Select Clip",
        "Clip Opacity Change",
        "Clip Speed Change",
        "Clip Volume Change",
      ],
      Column: [
        "Connect Column",
        "Select Column",
        "Layer Next Column",
        "Layer Previous Column",
        "Layer Group Next Column",
        "Layer Group Previous Column",
        "Connect Layer Group Column",
        "Select Layer Group Column",
      ],
      Layer: [
        "Bypass Layer",
        "Solo Layer",
        "Select Layer",
        "Clear Layer",
        "Clear All Layers",
        "Layer Master Change",
        "Layer Opacity Change",
        "Layer Volume Change",
        "Layer Transition Duration Change",
      ],
      "Layer Group": [
        "Bypass Layer Group",
        "Solo Layer Group",
        "Select Layer Group",
        "Clear Layer Group",
        "Layer Group Master Change",
        "Layer Group Opacity Change",
        "Layer Group Speed Change",
        "Layer Group Volume Change",
      ],
      Deck: [
        "Select Deck",
        "Select Next Deck",
        "Select Previous Deck",
      ],
      Custom: ["Custom OSC Command"],
    },
  },
  generic_tcp: {
    modes: ["Direct"],
    categories: {
      Commands: [
        "Send Command",
        "Send HEX encoded Command",
      ],
    },
  },
  companion_remote: {
    modes: ["Direct"],
    categories: {
      Satellite: [
        "Button Event",
      ],
    },
  },
  swp08: {
    modes: ["Direct"],
    categories: {
      Commands: [
        "Select Levels",
        "De-Select Levels",
        "Toggle Levels",
        "Select Destination",
        "Select Destination name",
        "Select Source",
        "Select Source name",
        "Route Source to selected Levels and Destination",
        "Route Source name to selected Levels and Destination",
        "Take",
        "Clear",
        "Set crosspoint",
        "Set crosspoint by name",
        "Refresh Source and Destination names",
      ],
    },
  },
  videohub: {
    modes: ["Direct"],
    categories: {
      VideoHub: [
        "Lock: Change destination lock state",
        "Lock: Change destination lock state (dynamic)",
        "Route File: Load file",
        "Route File: Save file",
        "Video: Clear queued route",
        "Video: Rename destination",
        "Video: Rename source",
        "Video: Return to previous route",
        "Video: Return to previous route (dynamic)",
        "Video: Route source to destination",
        "Video: Route source to destination (dynamic)",
        "Video: Route source to destination, based on another destination",
        "Video: Route source to destination, based on another destination (dynamic)",
        "Video: Route source to selected destination",
        "Video: Route source to selected destination (dynamic)",
        "Video: Select destination",
        "Video: Select destination (dynamic)",
        "Video: Take queued route",
      ],
    },
  },
  http_api: {
    modes: ["Direct"],
    categories: {
      Commands: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  },
  generic_osc: {
    modes: ["Direct"],
    categories: {
      Commands: [
        "Send blob",
        "Send boolean",
        "Send float",
        "Send int",
        "Send multiple",
        "Send blank",
        "Send midi",
        "Send string",
      ],
    },
  },
  x32: {
    modes: ["Direct"],
    categories: {
      "Levels / Sends / Pan": [
        "Adjust fader level",
        "Adjust level of bus to matrix send",
        "Adjust level of channel to bus send",
        "Adjust panning",
        "Adjust panning on bus to matrix bus send",
        "Adjust panning on channel to bus send",
        "Restore fader level",
        "Restore level of bus to matrix send",
        "Restore level of channel to bus send",
        "Restore panning",
        "Restore panning on bus to matrix send",
        "Restore panning on channel to bus send",
        "Set fader level",
        "Set level of bus to matrix send",
        "Set level of channel to bus send",
        "Set mute",
        "Set mute for bus to matrix send",
        "Set mute for channel to bus send",
        "Set panning",
        "Set panning on bus to matrix send",
        "Set panning on channel to bus send",
        "Store fader level",
        "Store level of bus to matrix send",
        "Store level of channel to bus send",
        "Store panning",
        "Store panning on bus to matrix send",
        "Store panning on channel to bus send",
      ],
      "Channel / Headamp / Insert": [
        "Set color",
        "Set input trim",
        "Set label",
        "Set Headamp gain",
        "Insert Destination",
        "Insert Position",
        "Insert Status",
        "Oscillator Destination",
        "Oscillator Enable",
      ],
      "Console / Scene / Preset": [
        "Do Undo",
        "Set Undo Checkpoint",
        "Go Command",
        "Next Command",
        "Previous Command",
        "Load Console Cue",
        "Load Console Scene",
        "Load Console snippet",
        "Load AES/DP48 preset",
        "Load channel preset",
        "Load effects preset",
        "Save scene",
      ],
      "Routing": [
        "Store channel for routing",
        "Route AES50 Blocks",
        "Route Aux Blocks",
        "Route Card Blocks",
        "Route Input Block Mode",
        "Route Input Blocks",
        "Route Left XLR Output Blocks",
        "Route Right XLR Output Blocks",
        "Route User Input",
        "Route User Output",
      ],
      "Navigation / Screen": [
        "Select",
        "Select active channel bank (X32 Compact/X32 Producer/M32R)",
        "Select active channel bank (X32/M32)",
        "Select active group bank (X32 compact/X32 Producer/M32R)",
        "Select active group bank (X32/M32)",
        "Select active screen on console",
        "Navigate to page on assign screen",
        "Navigate to page on channel screen",
        "Navigate to page on effects screen",
        "Navigate to page on library screen",
        "Navigate to page on meters screen",
        "Navigate to page on monitor screen",
        "Navigate to page on route screen",
        "Navigate to page on scene screen",
        "Navigate to page on setup screen",
        "Navigate to page on USB screen",
        "Navigate to the next or previous page",
        "Mute Group Screen",
        "Bus send bank",
        "User Assign Bank",
        "Utilities Screen",
      ],
      "Monitor / Solo / Mute Group": [
        "Set monitor level",
        "Set Dim Attenuation",
        "Solo Dim",
        "Solo Mono",
        "Solo On/Off",
        "Clear Solo",
        "Mute Group ON/OFF",
      ],
      "Talkback / Tape / X-Live / Card": [
        "Talkback Config",
        "Talkback Config - Single Source",
        "Talkback Restore Config",
        "Talkback Store Config",
        "Talkback Talk",
        "Tape Operation",
        "Add marker in recording",
        "Format SD Card",
        "Select Active SD Card",
        "Select number of recorded tracks",
        "Select playback device",
        "Sends on Fader/Fader Flip",
        "Set X-live State",
        "X-Live Clear Alert",
        "X-Live Position",
        "X-Live routing",
        "Sync console time",
        "Lock/Shutdown",
      ],
    },
  },
};

const ROSS_TALK_CATALOGUES: Record<NonNullable<Connection["rossTalkModel"]>, TaskCatalogue> = {
  carbonite: {
    modes: ["Direct"],
    categories: {
      General: ["Trigger GPI", "Trigger GPI by Name", "Send Custom Command"],
      Switcher: [
        "Fire Custom Control",
        "Load Set",
        "Cut",
        "Auto Transition",
        "XPT",
        "Transition Keyer",
        "Fade to Black",
      ],
      Memory: ["MEM", "SEQI", "SEQO", "Change Multiviewer Box"],
    },
  },
  acuity: {
    modes: ["Direct"],
    categories: {
      General: ["Trigger GPI", "Trigger GPI by Name", "Send Custom Command"],
      Switcher: [
        "Fire Custom Control",
        "Load Set",
        "Cut",
        "Auto Transition",
        "XPT",
        "Transition Keyer",
        "Fade to Black",
      ],
      Memory: ["MEM"],
    },
  },
  ultrix: {
    modes: ["Direct"],
    categories: {
      General: ["Trigger GPI", "Trigger GPI by Name", "Send Custom Command"],
      Timers: ["Ultrix Timer"],
    },
  },
  opengear: {
    modes: ["Direct"],
    categories: {
      General: ["Trigger GPI", "Trigger GPI by Name", "Send Custom Command"],
      Switcher: ["Fade to Black", "Transition Keyer"],
    },
  },
};

const ROSS_XPRESSION_CATALOGUE: TaskCatalogue = {
  modes: ["Direct"],
  categories: {
    XPression: [
      "Clear all framebuffers (CLRA)",
      "Clear framebuffer (CLFB)",
      "Clear layer in framebuffer (CLFB)",
      "Load all cued items to all framebuffers (SWAP)",
      "Load cued items in framebuffer (SWAP)",
      "Load take item to air on layer (SEQI)",
      "Load take item to framebuffer layer (TAKE)",
      "Move sequencer focus to next item (DOWN)",
      "Move sequencer focus to previous item (UP)",
      "Ready item into a framebuffer layer (CUE)",
      "Remove all cued items from the cued state (UNCUEALL)",
      "Remove take item from the cued state (UNCUE)",
      "Resume all layers in framebuffer (RESUME)",
      "Resume layer in framebuffer (RESUME)",
      "Set preview to take item (UPNEXT)",
      "Set sequencer focus to take item (FOCUS)",
      "Take layer in framebuffer off air (LAYEROFF)",
      "Take sequencer item to air (READ)",
      "Take sequencer item to air and advance next (NEXT)",
      "Take take item off air (SEQO)",
      "Trigger simulated GPI (GPI)",
      "Send a custom command",
    ],
  },
};

const HELP_TEXT: Record<string, string> = {
  "Aux/Output: Set source": "Input = AUX bus number. Value = source input number.",
  "Aux/Output: Set source from variables": "Input = AUX bus number (or variable). Value = source input number (or variable).",
  "Downstream key: Run AUTO Transition": "Input = downstream key number (default 1).",
  "Downstream key: Set inputs": "Input = downstream key number. Value = fill source and key source (for example \"5 6\").",
  "Downstream key: Set inputs from variables": "Input = downstream key number (or variable). Value = source input number (or variable).",
  "Downstream key: Set Mask": "Input = downstream key number. Value = top bottom left right (space/comma separated).",
  "Downstream key: Set OnAir": "Input = downstream key number. Value = ON, OFF, or TOGGLE.",
  "Downstream key: Set Pre Multiplied Key": "Input = downstream key number. Value = ON, OFF, or TOGGLE.",
  "Downstream key: Set Rate": "Input = downstream key number. Value = transition rate (frames).",
  "Downstream key: Set Tied": "Input = downstream key number. Value = TIE/TIED, ON, or OFF.",
  "Fade to black: Change rate": "Input = M/E number (default 1). Value = fade-to-black rate (frames).",
  "Fade to black: Run AUTO Transition": "Input = M/E number (default 1).",
  "Input: Set name": "Input = source/input number. Value = new input name.",
  "Macro: Continue": "No extra parameters required.",
  "Macro: Loop": "Input = macro number (default 1).",
  "Macro: Run": "Input = macro number.",
  "Macro: Stop": "No extra parameters required.",
  "ME: Perform AUTO transition": "Input = M/E number (default 1).",
  "ME: Perform CUT transition": "Input = M/E number (default 1).",
  "ME: Set Preview input": "Input = preview source number. Value = optional M/E number.",
  "ME: Set Preview input from variables": "Input = preview source (or variable). Value = optional M/E number (or variable).",
  "ME: Set Program input": "Input = program source number. Value = optional M/E number.",
  "ME: Set Program input from variables": "Input = program source (or variable). Value = optional M/E number (or variable).",
  "ME: Set TBar position": "Input = M/E number (default 1). Value = T-bar position (typically 0..10000).",
  "Media player: Capture still": "Input = media player number. Value = still slot number.",
  "Media player: Cycle source": "Input = media player number. Value = NEXT or PREV.",
  "Media player: Delete still": "Input = media player number. Value = still slot number.",
  "Media player: Set source": "Input = media player number. Value = STILL 1 or CLIP 1.",
  "Media player: Set source from variables": "Input = media player number (or variable). Value = STILL/CLIP + index (or variables).",
  "Multiviewer: Change layout": "Input = multiviewer number. Value = layout index.",
  "Multiviewer: Change window source": "Input = multiviewer,window (for example 1,5). Value = source input number.",
  "Multiviewer: Change window source from variables": "Input = multiviewer,window (or variables). Value = source (or variable).",
  "Startup State: Clear": "No extra parameters required.",
  "Startup State: Save": "No extra parameters required.",
  "Transition: Change rate": "Input = M/E number. Value = transition rate (frames).",
  "Transition: Change selection": "Input = M/E number. Value = BKGD, KEY1..KEY4, DSK1, DSK2.",
  "Transition: Change selection component": "Input = M/E and component (for example 1 KEY1). Value = ON, OFF, or TOGGLE.",
  "Transition: Preview": "Input = M/E number. Value = ON, OFF, or TOGGLE.",
  "Transition: Select components in transition": "Input = M/E number. Value = component string (for example BKGD+KEY1).",
  "Transition: Set style/pattern": "Input = M/E number. Value = MIX, DIP, WIPE, DVE, or STING.",
  "Upstream key: Set Flying Key (Luma, Chroma, Pattern)": "Input = M/E and key (for example 1 1). Value = A, B, RUN, ON, OFF, or TOGGLE.",
  "Upstream key: Set Flying Key (Luma, Chroma, Pattern) from variables": "Input = M/E and key (or variables). Value = fly action (or variable).",
  "Upstream key: Set inputs": "Input = M/E and key (for example 1 1). Value = fill source and key source (for example \"5 6\").",
  "Upstream key: Set inputs from variables": "Input = M/E and key (or variables). Value = source input (or variable).",
  "Upstream key: Set Mask (Luma, Chroma, Pattern)": "Input = M/E and key (for example 1 1). Value = top bottom left right.",
  "Upstream key: Set OnAir": "Input = M/E and key (for example 1 1). Value = ON, OFF, or TOGGLE.",
  "Upstream key: Set type": "Input = M/E and key (for example 1 1). Value = LUMA, CHROMA, PATTERN, or DVE.",
  "Clip Opacity Change": "Layer = layer number. Column = clip number. Action = +, -, or =. Value = percent.",
  "Clip Speed Change": "Layer = layer number. Column = clip number. Action = +, -, or =. Value = percent. (+ may depend on non-OSC APIs).",
  "Clip Volume Change": "Layer = layer number. Column = clip number. Action = +, -, or =. Value = dB.",
  "Select Clip": "Layer = layer number. Column = clip number.",
  "Trigger Clip": "Layer = layer number. Column = clip number.",
  "Connect Column": "Action = +, -, or =. Value = target column number.",
  "Connect Layer Group Column": "Layer Group = group number. Action = +, -, or =. Value = target column number.",
  "Layer Group Next Column": "Layer Group Number = group number. Last Column = maximum column for wrap behavior.",
  "Layer Group Previous Column": "Layer Group Number = group number. Last Column = maximum column for wrap behavior.",
  "Layer Next Column": "Layer Number = layer index.",
  "Layer Previous Column": "Layer Number = layer index.",
  "Select Column": "Action = +, -, or =. Value = target column number.",
  "Select Layer Group Column": "Layer Group = group number. Action = +, -, or =. Value = target column number.",
  "Clear All Layers": "Clears every layer in the composition.",
  "Clear Layer": "Layer = layer number.",
  "Clear Layer Group": "Layer Group = group number.",
  "Layer Master Change": "Layer = layer number. Action = +, -, or =. Value = percent.",
  "Layer Opacity Change": "Layer = layer number. Action = +, -, or =. Value = percent.",
  "Layer Transition Duration Change": "Layer = layer number. Action = +, -, or =. Value = seconds.",
  "Layer Volume Change": "Layer = layer number. Action = +, -, or =. Value = dB.",
  "Layer Group Master Change": "Layer Group = group number. Action = +, -, or =. Value = percent.",
  "Layer Group Opacity Change": "Layer Group = group number. Action = +, -, or =. Value = percent.",
  "Layer Group Speed Change": "Layer Group = group number. Action = +, -, or =. Value = percent.",
  "Layer Group Volume Change": "Layer Group = group number. Action = +, -, or =. Value = dB.",
  "Select Layer": "Layer = layer number.",
  "Select Layer Group": "Layer Group = group number.",
  "Select Deck": "Action = +, -, or =. Value = target deck number.",
  "Select Next Deck": "Selects the next deck.",
  "Select Previous Deck": "Selects the previous deck.",
  "Composition Next Column": "Triggers/connects the next composition column.",
  "Composition Previous Column": "Triggers/connects the previous composition column.",
  "Custom OSC Command": "OSC Address = path (for example /composition/layers/1/select). Args = optional JSON array/value or text.",
  "Bypass Layer": "Layer = layer number. Bypass = Toggle, On, or Off.",
  "Bypass Layer Group": "Layer Group = group number. Bypass = Toggle, On, or Off.",
  "Solo Layer": "Layer = layer number. Solo = Toggle, On, or Off.",
  "Solo Layer Group": "Layer Group = group number. Solo = Toggle, On, or Off.",
  "Trigger GPI": "Input = GPI number. Value is unused.",
  "Trigger GPI by Name": "Input = GPI name. Value = optional parameter.",
  "Send Custom Command": "Input = full RossTalk command. Use this for advanced commands not listed here.",
  "Fire Custom Control": "Input = CC bank. Value = CC number.",
  "Load Set": "Input = set name. For Acuity, Value can be USB or HD.",
  "Cut": "Input = MLE target, for example ME:1.",
  "Auto Transition": "Input = MLE target, for example ME:1.",
  "XPT": "Input = destination, for example ME:1:PGM. Value = source, for example IN:20.",
  "Transition Keyer":
    "Input = keyer reference such as ME:1:1. Value = CUT, AUTO, TOGGLE, CUTON, CUTOFF, AUTOON, or AUTOOFF.",
  "Fade to Black": "No extra parameters required.",
  MEM: "Input = memory id, for example 1:1 or 1:ME:1.",
  SEQI: "Input = take id. Value = layer.",
  SEQO: "Input = take id.",
  "Change Multiviewer Box": "Input = multiviewer:box, for example 1:5. Value = source, for example IN:3.",
  "Ultrix Timer": "Input = timer number. Value = RUN, PAUSE, STOP, or END.",
  "Clear all framebuffers (CLRA)": "No parameters required.",
  "Clear framebuffer (CLFB)":
    "Framebuffer = UI number (1 maps to RossTalk framebuffer 0).",
  "Clear layer in framebuffer (CLFB)":
    "Framebuffer = UI number (1 maps to RossTalk framebuffer 0). Layer = layer number.",
  "Load all cued items to all framebuffers (SWAP)": "No parameters required.",
  "Load cued items in framebuffer (SWAP)":
    "Framebuffer = UI number (1 maps to RossTalk framebuffer 0).",
  "Load take item to air on layer (SEQI)":
    "Take ID and Layer are required.",
  "Load take item to framebuffer layer (TAKE)":
    "Take ID, Framebuffer (UI index), and Layer are required.",
  "Move sequencer focus to next item (DOWN)": "No parameters required.",
  "Move sequencer focus to previous item (UP)": "No parameters required.",
  "Ready item into a framebuffer layer (CUE)":
    "Take ID, Framebuffer (UI index), and Layer are required.",
  "Remove all cued items from the cued state (UNCUEALL)": "No parameters required.",
  "Remove take item from the cued state (UNCUE)": "Take ID is required.",
  "Resume all layers in framebuffer (RESUME)":
    "Framebuffer = UI number (1 maps to RossTalk framebuffer 0).",
  "Resume layer in framebuffer (RESUME)":
    "Framebuffer = UI number (1 maps to RossTalk framebuffer 0). Layer = layer number.",
  "Set preview to take item (UPNEXT)": "Take ID is required.",
  "Set sequencer focus to take item (FOCUS)": "Take ID is required.",
  "Take layer in framebuffer off air (LAYEROFF)":
    "Framebuffer = UI number (1 maps to RossTalk framebuffer 0). Layer = layer number.",
  "Take sequencer item to air (READ)": "No parameters required.",
  "Take sequencer item to air and advance next (NEXT)": "No parameters required.",
  "Take take item off air (SEQO)": "Take ID is required.",
  "Trigger simulated GPI (GPI)": "GPI number is required.",
  "Send a custom command": "Input = full RossTalk command.",
  "Send Command": "Command text payload. End Character controls line ending (LF/CRLF/etc).",
  "Send HEX encoded Command": "Hex payload (for example 0A0DFF). End Character appends optional terminator bytes.",
  "Button Event":
    "Page = companion page number. Row/Column are zero-based location coordinates. Event Type = Press, Release, Rotate Left, or Rotate Right.",
  "At Menu": "Select the MA3 menu item.",
  "Call Macro via name": "Macro object name.",
  "Call Macro via number": "Macro object number.",
  "Call Plugin via name": "Plugin object name.",
  "Call Plugin via number": "Plugin object number.",
  "Executor Button": "Executor command text, for example Executor 1.1 At 100.",
  "Run Command": "Any raw MA3 command string.",
  "Select Group via name": "Group object name.",
  "Select Group via number": "Group object number.",
  "Select MAtrick via name": "MAtricks object name.",
  "Select MAtrick via number": "MAtricks object number.",
  "Select Quickey via name": "Quickey object name.",
  "Select Quickey via number": "Quickey object number.",
  "Select Sequence via name": "Sequence object name.",
  "Select Sequence via number": "Sequence object number.",
  "Adjust fader level":
    "If setting a fade duration, running another action for that value cancels the first and starts from current level.",
  "Do Undo":
    "If possible, undo to last checkpoint (X32 supports a single undo step).",
  "Go Command":
    "Loads highlighted cue/scene/snippet based on show control selection.",
  "Next Command":
    "Moves highlighted marker to next cue/scene/snippet (show control).",
  "Previous Command":
    "Moves highlighted marker to previous cue/scene/snippet (show control).",
  "Load Console Cue": "Input = cue number (0-99).",
  "Load Console Scene": "Input = scene number (0-99).",
  "Load Console snippet": "Input = snippet number (0-99).",
  "Tape Operation": "Input = operation (Stop, Play, PlayPause, Record, RecordPause, Fast Forward, Rewind).",
  "Talkback Talk": "Value = On or Off.",
};

function findConnection(connections: Connection[], name: string): Connection | undefined {
  return connections.find((connection) => connection.name === name);
}

function parseConnectionId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseDelayMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function findConnectionForTask(connections: Connection[], task: TaskEntry): Connection | undefined {
  const connectionId = parseConnectionId(task.connectionId);
  if (connectionId !== null) {
    const byId = connections.find((connection) => connection.id === connectionId);
    if (byId) return byId;
  }
  return findConnection(connections, task.connection);
}

export function getTaskCatalogue(connectionName: string, connections: Connection[]): TaskCatalogue {
  const connection = findConnection(connections, connectionName);
  if (!connection) return DEFAULT_CATALOGUE;
  const device = String(connection.device ?? "").trim().toLowerCase();
  if (device === "ross_talk") {
    return ROSS_TALK_CATALOGUES[connection.rossTalkModel ?? "carbonite"] ?? ROSS_TALK_CATALOGUES.carbonite;
  }
  if (device === "ross_xpression") {
    return ROSS_XPRESSION_CATALOGUE;
  }
  return STANDARD_CATALOGUES[device] ?? DEFAULT_CATALOGUE;
}

export function getTaskHelp(connectionName: string, funcName: string, connections: Connection[]): string {
  const connection = findConnection(connections, connectionName);
  if (!connection) return "Select a connection to load its command guide.";
  const help = HELP_TEXT[funcName];
  if (help) return help;
  const device = String(connection.device ?? "").trim().toLowerCase();
  if (device === "ross_talk" || device === "ross_xpression") {
    return "Use Input and Value according to the selected RossTalk function.";
  }
  const protocol = resolveConnectionProtocol(connection);
  if (protocol === "osc") {
    return "Input = OSC address (for example /layer/1/clip/1/connect). Value = optional argument or JSON array.";
  }
  if (protocol === "http") {
    return "Function can be HTTP method (GET/POST/etc). Input = path. Value = optional body (JSON supported).";
  }
  if (protocol === "ws") {
    return "Input = WebSocket/OBS request type. Value = optional requestData JSON.";
  }
  if (protocol === "artnet" || protocol === "dmx") {
    return "Input = channel number. Value = level 0-255, or provide a JSON array in Value for a full frame.";
  }
  if (protocol === "udp") {
    return "Input = UDP payload. Value = optional extra argument appended to the payload.";
  }
  if (protocol === "tcp") {
    return "Input = TCP command/payload. Value = optional extra argument appended to the payload.";
  }
  return "Selected function usage guide brief to add the proper information to fields.";
}

const ROSS_FUNCTION_MAP: Record<string, string> = {
  "trigger gpi": "gpi",
  "trigger gpi by name": "gpiByName",
  "send custom command": "custom",
  "fire custom control": "cc",
  "load set": "loadset",
  cut: "cut",
  "auto transition": "autotrans",
  xpt: "xpt",
  "transition keyer": "transKey",
  "fade to black": "ftb",
  mem: "mem",
  seqi: "seqi",
  seqo: "seqo",
  "change multiviewer box": "mvbox",
  "ultrix timer": "timer",
};

function normalizeRossFunctionName(label: string): string {
  return ROSS_FUNCTION_MAP[label.trim().toLowerCase()] ?? "";
}

function buildRossTalkRow(task: TaskEntry, connection: Connection): Record<string, unknown> {
  const input = task.input.trim();
  const value = task.value.trim();
  const action = normalizeRossFunctionName(task.funcName);

  if (!action) {
    throw new Error(`Unsupported RossTalk function "${task.funcName}"`);
  }

  const row: Record<string, unknown> = {
    kind: "task",
    id: task.id,
    connectionId: connection.id,
    device: connection.name,
    deviceName: connection.name,
    deviceType: connection.device,
    action,
  };

  switch (action) {
    case "gpi":
      row.gpi = input;
      break;
    case "gpiByName":
      row.gpiName = input;
      if (value) row.parameter = value;
      break;
    case "custom":
      row.command = input || value;
      break;
    case "cc":
      row.bank = input;
      row.cc = value;
      break;
    case "loadset":
      row.set = input;
      if (value) row.location = value;
      break;
    case "cut":
    case "autotrans":
      row.mle = input;
      break;
    case "xpt":
      row.destination = input;
      row.source = value;
      break;
    case "transKey":
      row.keyerRef = input;
      if (value) row.transition = value;
      break;
    case "mem":
      row.memId = input;
      break;
    case "seqi":
      row.takeId = input;
      row.layer = value;
      break;
    case "seqo":
      row.takeId = input;
      break;
    case "mvbox":
      row.mvBox = input;
      row.source = value;
      break;
    case "timer":
      row.timerId = input;
      row.timerAction = value;
      break;
    default:
      break;
  }

  return row;
}

function toRossFramebufferToken(raw: string, padded: boolean): string {
  const trimmed = raw.trim();
  if (!trimmed) return padded ? "0000" : "0";
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isFinite(parsed)) {
    const zeroBased = parsed > 0 ? parsed - 1 : 0;
    return padded ? String(zeroBased).padStart(4, "0") : String(zeroBased);
  }
  return trimmed;
}

function buildRossXpressionRow(task: TaskEntry, connection: Connection): Record<string, unknown> {
  const funcName = task.funcName.trim();
  const input = task.input.trim();
  const value = task.value.trim();

  const withCommand = (command: string): Record<string, unknown> => ({
    kind: "task",
    id: task.id,
    connectionId: connection.id,
    device: connection.name,
    deviceName: connection.name,
    deviceType: connection.device,
    action: "custom",
    command,
  });

  switch (funcName) {
    case "Clear all framebuffers (CLRA)":
      return withCommand("CLRA");
    case "Clear framebuffer (CLFB)":
      return withCommand(`CLFB ${toRossFramebufferToken(input || "1", true)}`);
    case "Clear layer in framebuffer (CLFB)":
      return withCommand(`CLFB ${toRossFramebufferToken(input || "1", true)}:${value || "0"}`);
    case "Load all cued items to all framebuffers (SWAP)":
      return withCommand("SWAP");
    case "Load cued items in framebuffer (SWAP)":
      return withCommand(`SWAP ${toRossFramebufferToken(input || "1", false)}`);
    case "Load take item to air on layer (SEQI)":
      return withCommand(`SEQI ${input || "0"}:${value || "0"}`);
    case "Load take item to framebuffer layer (TAKE)": {
      const base = (input || "0").includes(":")
        ? (input || "0")
        : `${input || "0"}:${toRossFramebufferToken("1", false)}`;
      return withCommand(`TAKE ${base}:${value || "0"}`);
    }
    case "Move sequencer focus to next item (DOWN)":
      return withCommand("DOWN");
    case "Move sequencer focus to previous item (UP)":
      return withCommand("UP");
    case "Ready item into a framebuffer layer (CUE)": {
      const base = (input || "0").includes(":")
        ? (input || "0")
        : `${input || "0"}:${toRossFramebufferToken("1", false)}`;
      return withCommand(`CUE ${base}:${value || "0"}`);
    }
    case "Remove all cued items from the cued state (UNCUEALL)":
      return withCommand("UNCUEALL");
    case "Remove take item from the cued state (UNCUE)":
      return withCommand(`UNCUE ${input || "0"}`);
    case "Resume all layers in framebuffer (RESUME)":
      return withCommand(`RESUME ${toRossFramebufferToken(input || "1", true)}`);
    case "Resume layer in framebuffer (RESUME)":
      return withCommand(`RESUME ${toRossFramebufferToken(input || "1", true)}:${value || "0"}`);
    case "Set preview to take item (UPNEXT)":
      return withCommand(`UPNEXT ${input || "0"}`);
    case "Set sequencer focus to take item (FOCUS)":
      return withCommand(`FOCUS ${input || "0"}`);
    case "Take layer in framebuffer off air (LAYEROFF)":
      return withCommand(`LAYEROFF ${toRossFramebufferToken(input || "1", true)}:${value || "0"}`);
    case "Take sequencer item to air (READ)":
      return withCommand("READ");
    case "Take sequencer item to air and advance next (NEXT)":
      return withCommand("NEXT");
    case "Take take item off air (SEQO)":
      return withCommand(`SEQO ${input || "0"}`);
    case "Trigger simulated GPI (GPI)":
      return withCommand(`GPI ${input || "0"}`);
    case "Send a custom command": {
      const command = input || value;
      if (!command) {
        throw new Error(`Ross XPression task "${task.id}" needs a command in Input or Value.`);
      }
      return withCommand(command);
    }
    default:
      return withCommand(input || value || funcName);
  }
}

function resolveConnectionProtocol(connection: Connection): string {
  const protocol = String(connection.protocol ?? "").trim().toLowerCase();
  const device = String(connection.device ?? "").trim().toLowerCase();
  const merged = `${protocol} ${device}`;

  if (merged.includes("ross")) return "rosstalk";
  if (merged.includes("osc")) return "osc";
  if (merged.includes("http")) return "http";
  if (merged.includes("websocket") || merged.includes(" ws") || merged.includes("obs")) return "ws";
  if (merged.includes("udp") || merged.includes("atem")) return "udp";
  if (merged.includes("artnet")) return "artnet";
  if (merged.includes("dmx")) return "dmx";
  return "tcp";
}

function parseLooseValue(value: string): unknown {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && raw !== "") return numeric;
  return raw;
}

function deriveHttpMethod(funcName: string): string | null {
  const normalized = funcName.trim().toUpperCase();
  if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(normalized)) {
    return normalized;
  }
  return null;
}

function isPlaceholderFunctionLabel(funcName: string): boolean {
  const normalized = funcName.trim().toLowerCase();
  return normalized === "execute" || normalized === "toggle" || normalized === "trigger";
}

function buildGenericManualRow(task: TaskEntry, connection: Connection): Record<string, unknown> {
  const input = task.input.trim();
  const value = task.value.trim();
  const funcName = task.funcName.trim();
  const protocol = resolveConnectionProtocol(connection);

  const row: Record<string, unknown> = {
    kind: "task",
    id: task.id,
    connectionId: connection.id,
    device: connection.name,
    deviceName: connection.name,
    deviceType: connection.device,
    protocol,
  };

  if (protocol === "osc") {
    const address = input || (funcName.startsWith("/") ? funcName : "");
    if (!address) {
      throw new Error(`OSC task "${funcName || task.id}" is missing address Input.`);
    }
    row.action = "osc";
    row.address = address;
    if (value) {
      const parsedValue = parseLooseValue(value);
      row.args = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
    }
    return row;
  }

  if (protocol === "http") {
    row.action = "http";
    row.method = deriveHttpMethod(funcName) ?? (value ? "POST" : "GET");
    row.path = input || "/";
    if (value) {
      row.body = parseLooseValue(value);
    }
    return row;
  }

  if (protocol === "ws") {
    const requestType = input || (!isPlaceholderFunctionLabel(funcName) ? funcName : "");
    if (!requestType) {
      throw new Error(`WebSocket/OBS task "${task.id}" needs Input (request type).`);
    }
    row.action = "command";
    row.requestType = requestType;
    if (value) {
      row.requestData = parseLooseValue(value);
    }
    return row;
  }

  if (protocol === "artnet" || protocol === "dmx") {
    row.action = "command";
    const channel = Number.parseInt(input, 10);
    const level = Number.parseInt(value, 10);
    if (Number.isFinite(channel) && channel > 0 && Number.isFinite(level) && level >= 0) {
      row.channel = channel;
      row.value = level;
      return row;
    }
    if (value) {
      const parsed = parseLooseValue(value);
      if (Array.isArray(parsed)) {
        row.values = parsed;
        return row;
      }
    }
    throw new Error(`Artnet/DMX task "${funcName || task.id}" needs Input channel + Value level, or Value JSON array.`);
  }

  if (protocol === "rosstalk") {
    row.action = "custom";
    row.command = input || value || funcName;
    if (!String(row.command ?? "").trim()) {
      throw new Error(`RossTalk task "${task.id}" needs Input/Value payload.`);
    }
    return row;
  }

  // TCP/UDP default: treat Input as command and Value as optional suffix.
  row.action = "command";
  if (input) {
    row.command = [input, value].filter(Boolean).join(" ").trim();
  } else if (value) {
    row.command = value;
  } else if (!isPlaceholderFunctionLabel(funcName)) {
    row.command = funcName;
  } else {
    row.command = "";
  }
  if (!String(row.command ?? "").trim()) {
    throw new Error(`Task "${funcName || task.id}" needs Input or Value payload.`);
  }
  return row;
}

function parseFirstPositiveInteger(text: string, fallback: number): number {
  const match = text.match(/\d+/);
  if (!match) return fallback;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTwoPositiveIntegers(text: string, fallbackA: number, fallbackB: number): [number, number] {
  const matches = text.match(/\d+/g) ?? [];
  const a = matches[0] ? Number.parseInt(matches[0], 10) : fallbackA;
  const b = matches[1] ? Number.parseInt(matches[1], 10) : fallbackB;
  return [
    Number.isFinite(a) && a > 0 ? a : fallbackA,
    Number.isFinite(b) && b > 0 ? b : fallbackB,
  ];
}

function parseMaskQuad(value: string): [number, number, number, number] {
  const tokens = value.split(/[,\s]+/).map((token) => token.trim()).filter(Boolean);
  const parsed = tokens.slice(0, 4).map((token) => Number.parseFloat(token));
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i += 1) {
    out[i] = Number.isFinite(parsed[i] ?? Number.NaN) ? (parsed[i] as number) : 0;
  }
  return out;
}

function buildAtemRow(task: TaskEntry, connection: Connection): Record<string, unknown> {
  const funcName = task.funcName.trim();
  const input = task.input.trim();
  const value = task.value.trim();
  const upperValue = value.toUpperCase();

  const wrap = (command: string): Record<string, unknown> => ({
    kind: "task",
    id: task.id,
    connectionId: connection.id,
    device: connection.name,
    deviceName: connection.name,
    deviceType: connection.device,
    action: "command",
    command,
  });

  switch (funcName) {
    case "Aux/Output: Set source":
    case "Aux/Output: Set source from variables": {
      const bus = parseFirstPositiveInteger(input, 1);
      const src = parseFirstPositiveInteger(value, 1);
      return wrap(`AUX ${bus} ${src}`);
    }
    case "Downstream key: Run AUTO Transition": {
      const dsk = parseFirstPositiveInteger(input, 1);
      return wrap(`DSK ${dsk} AUTO`);
    }
    case "Downstream key: Set inputs":
    case "Downstream key: Set inputs from variables": {
      const dsk = parseFirstPositiveInteger(input, 1);
      const src = parseFirstPositiveInteger(value, 1);
      return wrap(`DSK ${dsk} SOURCE ${src}`);
    }
    case "Downstream key: Set Mask": {
      const dsk = parseFirstPositiveInteger(input, 1);
      const [top, bottom, left, right] = parseMaskQuad(value);
      return wrap(`DSK ${dsk} MASK ${top} ${bottom} ${left} ${right}`);
    }
    case "Downstream key: Set OnAir": {
      const dsk = parseFirstPositiveInteger(input, 1);
      const state = ["ON", "OFF", "TOGGLE"].includes(upperValue) ? upperValue : "TOGGLE";
      return wrap(`DSK ${dsk} ${state}`);
    }
    case "Downstream key: Set Pre Multiplied Key": {
      const dsk = parseFirstPositiveInteger(input, 1);
      const mode = ["ON", "OFF", "TOGGLE"].includes(upperValue) ? upperValue : "ON";
      return wrap(`DSK ${dsk} PREMULT ${mode}`);
    }
    case "Downstream key: Set Rate": {
      const dsk = parseFirstPositiveInteger(input, 1);
      const rate = parseFirstPositiveInteger(value, 25);
      return wrap(`DSK ${dsk} RATE ${rate}`);
    }
    case "Downstream key: Set Tied": {
      const dsk = parseFirstPositiveInteger(input, 1);
      const mode = ["TIE", "TIED", "ON", "OFF"].includes(upperValue) ? upperValue : "TIE";
      return wrap(`DSK ${dsk} ${mode}`);
    }
    case "Fade to black: Change rate": {
      const me = parseFirstPositiveInteger(input, 1);
      const rate = parseFirstPositiveInteger(value, 25);
      return wrap(`FTB ${me} RATE ${rate}`);
    }
    case "Fade to black: Run AUTO Transition": {
      const me = parseFirstPositiveInteger(input, 1);
      return wrap(`FTB ${me} AUTO`);
    }
    case "Input: Set name": {
      const src = parseFirstPositiveInteger(input, 1);
      const name = value || "Input 1";
      return wrap(`INPUT ${src} NAME ${name}`);
    }
    case "Macro: Continue":
      return wrap("MACRO CONTINUE");
    case "Macro: Loop": {
      const macro = parseFirstPositiveInteger(input, 1);
      return wrap(`MACRO LOOP ${macro}`);
    }
    case "Macro: Run": {
      const macro = parseFirstPositiveInteger(input, 1);
      return wrap(`MACRO RUN ${macro}`);
    }
    case "Macro: Stop":
      return wrap("MACRO STOP");
    case "ME: Perform AUTO transition": {
      const me = parseFirstPositiveInteger(input, 1);
      return wrap(`ME ${me} AUTO`);
    }
    case "ME: Perform CUT transition": {
      const me = parseFirstPositiveInteger(input, 1);
      return wrap(`ME ${me} CUT`);
    }
    case "ME: Set Preview input":
    case "ME: Set Preview input from variables": {
      const src = parseFirstPositiveInteger(input, 1);
      const me = parseFirstPositiveInteger(value, 1);
      return wrap(`PREVIEW ${src} ${me}`);
    }
    case "ME: Set Program input":
    case "ME: Set Program input from variables": {
      const src = parseFirstPositiveInteger(input, 1);
      const me = parseFirstPositiveInteger(value, 1);
      return wrap(`PROGRAM ${src} ${me}`);
    }
    case "ME: Set TBar position": {
      const me = parseFirstPositiveInteger(input, 1);
      const position = parseFirstPositiveInteger(value, 5000);
      return wrap(`ME ${me} TBAR ${position}`);
    }
    case "Media player: Capture still": {
      const player = parseFirstPositiveInteger(input, 1);
      const still = parseFirstPositiveInteger(value, 1);
      return wrap(`MEDIAPLAYER ${player} CAPTURE ${still}`);
    }
    case "Media player: Cycle source": {
      const player = parseFirstPositiveInteger(input, 1);
      const direction = ["PREV", "PREVIOUS"].includes(upperValue) ? "PREV" : "NEXT";
      return wrap(`MEDIAPLAYER ${player} ${direction}`);
    }
    case "Media player: Delete still": {
      const player = parseFirstPositiveInteger(input, 1);
      const still = parseFirstPositiveInteger(value, 1);
      return wrap(`MEDIAPLAYER ${player} DELETE STILL ${still}`);
    }
    case "Media player: Set source":
    case "Media player: Set source from variables": {
      const player = parseFirstPositiveInteger(input, 1);
      const sourceType = upperValue.includes("CLIP") ? "CLIP" : "STILL";
      const sourceIndex = parseFirstPositiveInteger(value, 1);
      return wrap(`MEDIAPLAYER ${player} ${sourceType} ${sourceIndex}`);
    }
    case "Multiviewer: Change layout": {
      const mv = parseFirstPositiveInteger(input, 1);
      const layout = parseFirstPositiveInteger(value, 1);
      return wrap(`MV ${mv} LAYOUT ${layout}`);
    }
    case "Multiviewer: Change window source":
    case "Multiviewer: Change window source from variables": {
      const [mv, window] = parseTwoPositiveIntegers(input, 1, 1);
      const source = parseFirstPositiveInteger(value, 1);
      return wrap(`MV ${mv} WINDOW ${window} SOURCE ${source}`);
    }
    case "Startup State: Clear":
      return wrap("STARTUP CLEAR");
    case "Startup State: Save":
      return wrap("STARTUP SAVE");
    case "Transition: Change rate": {
      const me = parseFirstPositiveInteger(input, 1);
      const rate = parseFirstPositiveInteger(value, 25);
      return wrap(`TRANSITION ${me} RATE ${rate}`);
    }
    case "Transition: Change selection": {
      const me = parseFirstPositiveInteger(input, 1);
      const selection = value.trim().toUpperCase() || "BKGD";
      return wrap(`TRANSITION ${me} SELECTION ${selection}`);
    }
    case "Transition: Change selection component": {
      const [me, componentIdx] = parseTwoPositiveIntegers(input, 1, 1);
      const component = `KEY${componentIdx}`;
      const state = ["ON", "OFF", "TOGGLE"].includes(upperValue) ? upperValue : "TOGGLE";
      return wrap(`TRANSITION ${me} COMPONENT ${component} ${state}`);
    }
    case "Transition: Preview": {
      const me = parseFirstPositiveInteger(input, 1);
      const mode = ["ON", "OFF", "TOGGLE"].includes(upperValue) ? upperValue : "TOGGLE";
      return wrap(`TRANSITION ${me} PREVIEW ${mode}`);
    }
    case "Transition: Select components in transition": {
      const me = parseFirstPositiveInteger(input, 1);
      const components = value.trim().toUpperCase() || "BKGD+KEY1";
      return wrap(`TRANSITION ${me} SELECT ${components}`);
    }
    case "Transition: Set style/pattern": {
      const me = parseFirstPositiveInteger(input, 1);
      const style = value.trim().toUpperCase() || "MIX";
      return wrap(`TRANSITION ${me} STYLE ${style}`);
    }
    case "Upstream key: Set Flying Key (Luma, Chroma, Pattern)":
    case "Upstream key: Set Flying Key (Luma, Chroma, Pattern) from variables": {
      const [me, key] = parseTwoPositiveIntegers(input, 1, 1);
      const mode = value.trim().toUpperCase() || "RUN";
      return wrap(`USK ${me} ${key} FLY ${mode}`);
    }
    case "Upstream key: Set inputs":
    case "Upstream key: Set inputs from variables": {
      const [me, key] = parseTwoPositiveIntegers(input, 1, 1);
      const source = parseFirstPositiveInteger(value, 1);
      return wrap(`USK ${me} ${key} SOURCE ${source}`);
    }
    case "Upstream key: Set Mask (Luma, Chroma, Pattern)": {
      const [me, key] = parseTwoPositiveIntegers(input, 1, 1);
      const [top, bottom, left, right] = parseMaskQuad(value);
      return wrap(`USK ${me} ${key} MASK ${top} ${bottom} ${left} ${right}`);
    }
    case "Upstream key: Set OnAir": {
      const [me, key] = parseTwoPositiveIntegers(input, 1, 1);
      const state = ["ON", "OFF", "TOGGLE"].includes(upperValue) ? upperValue : "TOGGLE";
      return wrap(`USK ${me} ${key} ${state}`);
    }
    case "Upstream key: Set type": {
      const [me, key] = parseTwoPositiveIntegers(input, 1, 1);
      const keyType = ["LUMA", "CHROMA", "PATTERN", "DVE"].includes(upperValue) ? upperValue : "LUMA";
      return wrap(`USK ${me} ${key} TYPE ${keyType}`);
    }
    default:
      return buildGenericManualRow(task, connection);
  }
}

export function compileDashboardRows(tasks: TaskEntry[], connections: Connection[]): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  for (const task of tasks) {
    if (task.enabled === false) {
      continue;
    }
    const params = isTaskParams(task.params) ? task.params : null;
    const waitMs = params?.action === "wait"
      ? (parseDelayMs(params.waitMs) ?? parseDelayMs(task.value))
      : null;
    if (waitMs !== null) {
      rows.push({
        kind: "delay",
        id: task.id,
        ms: waitMs,
      });
      continue;
    }

    const connection = findConnectionForTask(connections, task);
    if (!connection) {
      throw new Error(
        `Connection "${task.connection}"${task.connectionId ? ` (id: ${task.connectionId})` : ""} was not found.`,
      );
    }
    if (connection.active === false) {
      continue;
    }

    const device = String(connection.device ?? "").trim().toLowerCase();
    if (isTaskParams(task.params)) {
      rows.push(buildShortcutRow(task, connection));
    } else if (device === "atem") {
      rows.push(buildAtemRow(task, connection));
    } else if (device === "ross_talk") {
      rows.push(buildRossTalkRow(task, connection));
    } else if (device === "ross_xpression") {
      rows.push(buildRossXpressionRow(task, connection));
    } else {
      rows.push(buildGenericManualRow(task, connection));
    }

    const pauseMs = Number.parseInt(task.pause, 10);
    if (Number.isFinite(pauseMs) && pauseMs > 0) {
      rows.push({
        kind: "delay",
        id: `${task.id}-pause`,
        ms: pauseMs,
      });
    }
  }

  return rows;
}
