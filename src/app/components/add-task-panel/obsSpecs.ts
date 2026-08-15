export const OBS_SCENE_FUNCTION_TO_REQUEST: Record<string, string> = {
  'Set Program Scene': 'SetCurrentProgramScene',
  'Set Preview Scene': 'SetCurrentPreviewScene',
  'Smart Scene Switcher': 'SetCurrentPreviewScene',
};
export const OBS_SCENE_FUNCTIONS = new Set<string>(
  Object.keys(OBS_SCENE_FUNCTION_TO_REQUEST)
);
export type ObsFunctionSpec = {
  requestType: string;
  defaultRequestData?: Record<string, unknown>;
  parameterKind?:
    | 'scenes'
    | 'sceneItems'
    | 'inputs'
    | 'transitions'
    | 'profiles'
    | 'sceneCollections'
    | 'outputs'
    | 'hotkeys';
  parameterKey?: string;
  parameterLabel?: string;
  valueLabel?: string;
  fields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'json';
    placeholder?: string;
    options?: string[];
    optionsKind?: ObsFunctionSpec['parameterKind'];
    defaultValue?: string;
  }>;
};

export const OBS_FUNCTION_SPECS: Record<string, ObsFunctionSpec> = {
  'Toggle Recording': { requestType: 'ToggleRecord' },
  'Start Recording': { requestType: 'StartRecord' },
  'Stop Recording': { requestType: 'StopRecord' },
  'Toggle Recording Pause': { requestType: 'ToggleRecordPause' },
  'Pause Recording': { requestType: 'PauseRecord' },
  'Resume Recording': { requestType: 'ResumeRecord' },
  'Split Recording': { requestType: 'SplitRecordFile' },
  'Start Streaming': { requestType: 'StartStream' },
  'Stop Streaming': { requestType: 'StopStream' },
  'Toggle Streaming': { requestType: 'ToggleStream' },
  'Start Replay Buffer': { requestType: 'StartReplayBuffer' },
  'Stop Replay Buffer': { requestType: 'StopReplayBuffer' },
  'Toggle Replay Buffer': { requestType: 'ToggleReplayBuffer' },
  'Save Replay Buffer': { requestType: 'SaveReplayBuffer' },
  'Enable Studio Mode': {
    requestType: 'SetStudioModeEnabled',
    defaultRequestData: { studioModeEnabled: true },
  },
  'Disable Studio Mode': {
    requestType: 'SetStudioModeEnabled',
    defaultRequestData: { studioModeEnabled: false },
  },
  'Toggle Studio Mode': { requestType: 'ToggleStudioMode' },
  Transition: { requestType: 'TriggerStudioModeTransition' },
  'Preview Next Scene': {
    requestType: 'AUTOCOM_PREVIEW_SCENE_STEP',
    fields: [
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: ['next'],
        defaultValue: 'next',
      },
    ],
  },
  'Preview Previous Scene': {
    requestType: 'AUTOCOM_PREVIEW_SCENE_STEP',
    fields: [
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: ['previous'],
        defaultValue: 'previous',
      },
    ],
  },
  'Set Transition Type': {
    requestType: 'SetCurrentSceneTransition',
    parameterKind: 'transitions',
    parameterKey: 'transitionName',
    parameterLabel: 'Transition',
  },
  'Set Profile': {
    requestType: 'SetCurrentProfile',
    parameterKind: 'profiles',
    parameterKey: 'profileName',
    parameterLabel: 'Profile',
  },
  'Set Scene Collection': {
    requestType: 'SetCurrentSceneCollection',
    parameterKind: 'sceneCollections',
    parameterKey: 'sceneCollectionName',
    parameterLabel: 'Scene Collection',
  },
  'Start Output': {
    requestType: 'StartOutput',
    parameterKind: 'outputs',
    parameterKey: 'outputName',
    parameterLabel: 'Output',
  },
  'Stop Output': {
    requestType: 'StopOutput',
    parameterKind: 'outputs',
    parameterKey: 'outputName',
    parameterLabel: 'Output',
  },
  'Toggle Output': {
    requestType: 'ToggleOutput',
    parameterKind: 'outputs',
    parameterKey: 'outputName',
    parameterLabel: 'Output',
  },
  'Trigger Hotkey by ID': {
    requestType: 'TriggerHotkeyByName',
    parameterKind: 'hotkeys',
    parameterKey: 'hotkeyName',
    parameterLabel: 'Hotkey',
  },
  'Toggle Source Mute': {
    requestType: 'ToggleInputMute',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
  },
  'Set Source Mute': {
    requestType: 'SetInputMute',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'inputMuted',
        label: 'Mute',
        type: 'select',
        options: ['on', 'off', 'toggle'],
        defaultValue: 'toggle',
      },
    ],
  },
  'Set Source Volume': {
    requestType: 'SetInputVolume',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Volume in dB',
  },
  'Adjust Source Volume (dB)': {
    requestType: 'OffsetInputVolume',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Volume offset in dB',
  },
  'Adjust Source Volume (Percentage)': {
    requestType: 'SetInputVolume',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Percent Adjustment',
  },
  'Set Audio Monitor': {
    requestType: 'SetInputAudioMonitorType',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'monitorType',
        label: 'Monitor Type',
        type: 'select',
        options: [
          'OBS_MONITORING_TYPE_NONE',
          'OBS_MONITORING_TYPE_MONITOR_ONLY',
          'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT',
        ],
        defaultValue: 'OBS_MONITORING_TYPE_NONE',
      },
    ],
  },
  'Set Audio Sync Offset': {
    requestType: 'SetInputAudioSyncOffset',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Sync Offset (ms)',
  },
  'Adjust Audio Sync Offset': {
    requestType: 'OffsetInputAudioSyncOffset',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Sync Offset Delta (ms)',
  },
  'Set Audio Balance': {
    requestType: 'SetInputAudioBalance',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Balance (0.0 left to 1.0 right)',
  },
  'Adjust Audio Balance': {
    requestType: 'OffsetInputAudioBalance',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
    valueLabel: 'Balance Delta',
  },
  'Play / Pause Media': {
    requestType: 'TriggerMediaInputAction',
    fields: [
      {
        key: 'inputName',
        label: 'Media Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'mediaAction',
        label: 'Action',
        type: 'select',
        options: [
          'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
          'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
          'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY_PAUSE',
          'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
        ],
        defaultValue: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY_PAUSE',
      },
    ],
  },
  'Restart Media': {
    requestType: 'TriggerMediaInputAction',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Media Source',
  },
  'Stop Media': {
    requestType: 'TriggerMediaInputAction',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Media Source',
  },
  'Next Media': {
    requestType: 'TriggerMediaInputAction',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Media Source',
  },
  'Previous Media': {
    requestType: 'TriggerMediaInputAction',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Media Source',
  },
  'Set Media Time': {
    requestType: 'SetMediaInputCursor',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Media Source',
    valueLabel: 'Timecode in seconds',
  },
  'Scrub Media': {
    requestType: 'OffsetMediaInputCursor',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Media Source',
    valueLabel: 'Scrub offset in seconds',
  },
  'Open Source Properties Window': {
    requestType: 'OpenInputPropertiesDialog',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
  },
  'Open Source Filters Window': {
    requestType: 'OpenInputFiltersDialog',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
  },
  'Open Source Interact Window': {
    requestType: 'OpenInputInteractDialog',
    parameterKind: 'inputs',
    parameterKey: 'inputName',
    parameterLabel: 'Source',
  },
  'Set Transition Duration': {
    requestType: 'SetCurrentSceneTransitionDuration',
    fields: [
      {
        key: 'transitionDuration',
        label: 'Transition time (ms)',
        type: 'number',
        defaultValue: '500',
      },
    ],
  },
  'Adjust Transition Duration': {
    requestType: 'SetCurrentSceneTransitionDuration',
    fields: [
      {
        key: 'transitionDuration',
        label: 'Transition time (ms)',
        type: 'number',
        defaultValue: '500',
      },
    ],
  },
  'Adjust Transition Type': {
    requestType: 'AUTOCOM_TRANSITION_TYPE_STEP',
    fields: [
      {
        key: 'direction',
        label: 'Adjust',
        type: 'select',
        options: ['next', 'previous'],
        defaultValue: 'next',
      },
    ],
  },
  'Quick Transition': {
    requestType: 'TriggerStudioModeTransition',
  },
  'Set Stream Settings': {
    requestType: 'SetStreamServiceSettings',
    fields: [
      {
        key: 'streamServiceType',
        label: 'Stream Type',
        type: 'select',
        options: ['rtmp_custom', 'rtmp_common'],
        defaultValue: 'rtmp_custom',
      },
      {
        key: 'streamServiceSettings.server',
        label: 'Stream URL',
        type: 'text',
      },
      { key: 'streamServiceSettings.key', label: 'Stream Key', type: 'text' },
      {
        key: 'streamServiceSettings.use_auth',
        label: 'Use Authentication',
        type: 'select',
        options: ['false', 'true'],
        defaultValue: 'false',
      },
      {
        key: 'streamServiceSettings.username',
        label: 'Username',
        type: 'text',
      },
      {
        key: 'streamServiceSettings.password',
        label: 'Password',
        type: 'text',
      },
    ],
  },
  'Create Record Chapter': {
    requestType: 'CreateRecordChapter',
    fields: [{ key: 'chapterName', label: 'Chapter Name', type: 'text' }],
  },
  'Send Stream Caption': {
    requestType: 'SendStreamCaption',
    fields: [{ key: 'captionText', label: 'Caption Text', type: 'text' }],
  },
  'Set Filter Visibility': {
    requestType: 'AUTOCOM_FILTER_VISIBILITY',
    fields: [
      {
        key: 'sourceName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      { key: 'filterName', label: 'Filter', type: 'text' },
      {
        key: 'filterEnabled',
        label: 'Visibility',
        type: 'select',
        options: ['on', 'off', 'toggle'],
        defaultValue: 'toggle',
      },
    ],
  },
  'Set Filter Settings': {
    requestType: 'SetSourceFilterSettings',
    fields: [
      {
        key: 'sourceName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      { key: 'filterName', label: 'Filter', type: 'text' },
      {
        key: 'filterSettings',
        label: 'Filter Settings JSON',
        type: 'json',
        placeholder: '{"left":100}',
      },
    ],
  },
  'Set Source Visibility': {
    requestType: 'AUTOCOM_SCENE_ITEM_VISIBILITY',
    fields: [
      {
        key: 'sceneName',
        label: 'Scene',
        type: 'select',
        optionsKind: 'scenes',
      },
      {
        key: 'sceneItemId',
        label: 'Scene Item',
        type: 'select',
        optionsKind: 'sceneItems',
      },
      {
        key: 'sceneItemEnabled',
        label: 'Visible',
        type: 'select',
        options: ['on', 'off', 'toggle'],
        defaultValue: 'toggle',
      },
    ],
  },
  'Set Source Transform': {
    requestType: 'SetSceneItemTransform',
    fields: [
      {
        key: 'sceneName',
        label: 'Scene',
        type: 'select',
        optionsKind: 'scenes',
      },
      {
        key: 'sceneItemId',
        label: 'Scene Item',
        type: 'select',
        optionsKind: 'sceneItems',
      },
      {
        key: 'sceneItemTransform.positionX',
        label: 'Position X',
        type: 'number',
      },
      {
        key: 'sceneItemTransform.positionY',
        label: 'Position Y',
        type: 'number',
      },
      { key: 'sceneItemTransform.scaleX', label: 'Scale X', type: 'number' },
      { key: 'sceneItemTransform.scaleY', label: 'Scale Y', type: 'number' },
      { key: 'sceneItemTransform.rotation', label: 'Rotation', type: 'number' },
    ],
  },
  'Set Source Text': {
    requestType: 'SetInputSettings',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      { key: 'inputSettings.text', label: 'Text', type: 'text' },
    ],
  },
  'Set Text Properties': {
    requestType: 'SetInputSettings',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'inputSettings',
        label: 'Properties JSON',
        type: 'json',
        placeholder: '{"font":{"size":72}}',
      },
    ],
  },
  'Refresh Browser Source': {
    requestType: 'PressInputPropertiesButton',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'propertyName',
        label: 'Property',
        type: 'text',
        defaultValue: 'refreshnocache',
      },
    ],
  },
  'Reset Video Capture Device': {
    requestType: 'PressInputPropertiesButton',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'propertyName',
        label: 'Property',
        type: 'text',
        defaultValue: 'refresh',
      },
    ],
  },
  'Update Media Source Local File Path': {
    requestType: 'SetInputSettings',
    fields: [
      {
        key: 'inputName',
        label: 'Media Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      { key: 'inputSettings.local_file', label: 'File Path', type: 'text' },
    ],
  },
  'Open Projector': {
    requestType: 'OpenVideoMixProjector',
    fields: [
      {
        key: 'videoMixType',
        label: 'Projector Type',
        type: 'select',
        options: [
          'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM',
          'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PREVIEW',
        ],
        defaultValue: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM',
      },
      {
        key: 'monitorIndex',
        label: 'Monitor Index',
        type: 'number',
        defaultValue: '0',
      },
      { key: 'projectorGeometry', label: 'Geometry (optional)', type: 'text' },
    ],
  },
  'Take Screenshot': {
    requestType: 'GetSourceScreenshot',
    fields: [
      {
        key: 'sourceName',
        label: 'Source',
        type: 'select',
        optionsKind: 'scenes',
      },
      {
        key: 'imageFormat',
        label: 'Format',
        type: 'select',
        options: ['png', 'jpg'],
        defaultValue: 'png',
      },
      {
        key: 'imageCompressionQuality',
        label: 'Compression Quality (0-100)',
        type: 'number',
        defaultValue: '0',
      },
    ],
  },
  'Fade Source Volume': {
    requestType: 'AUTOCOM_FADE_INPUT_VOLUME',
    fields: [
      {
        key: 'inputName',
        label: 'Source',
        type: 'select',
        optionsKind: 'inputs',
      },
      {
        key: 'targetDb',
        label: 'Target Volume (dB)',
        type: 'number',
        defaultValue: '0',
      },
      {
        key: 'durationMs',
        label: 'Fade Duration (ms)',
        type: 'number',
        defaultValue: '500',
      },
    ],
  },
  'Trigger Hotkey by Key': {
    requestType: 'TriggerHotkeyByKeySequence',
    fields: [
      { key: 'keyId', label: 'Key', type: 'text', defaultValue: 'OBS_KEY_A' },
      {
        key: 'keyModifiers.shift',
        label: 'Shift',
        type: 'select',
        options: ['false', 'true'],
        defaultValue: 'false',
      },
      {
        key: 'keyModifiers.alt',
        label: 'Alt / Option',
        type: 'select',
        options: ['false', 'true'],
        defaultValue: 'false',
      },
      {
        key: 'keyModifiers.control',
        label: 'Control',
        type: 'select',
        options: ['false', 'true'],
        defaultValue: 'false',
      },
      {
        key: 'keyModifiers.command',
        label: 'Command (Mac)',
        type: 'select',
        options: ['false', 'true'],
        defaultValue: 'false',
      },
    ],
  },
  'Custom Vendor Request': {
    requestType: 'CallVendorRequest',
    fields: [
      { key: 'vendorName', label: 'Vendor Name', type: 'text' },
      { key: 'requestType', label: 'Request Type', type: 'text' },
      {
        key: 'requestData',
        label: 'Request Data JSON',
        type: 'json',
        placeholder: '{"key":"value"}',
      },
    ],
  },
  'Custom Command': {
    requestType: 'AUTOCOM_CUSTOM_REQUEST',
    fields: [
      { key: 'customRequestType', label: 'Request Type', type: 'text' },
      {
        key: 'customRequestData',
        label: 'Request Data JSON',
        type: 'json',
        placeholder: '{"sceneName":"Scene 1"}',
      },
    ],
  },
};
