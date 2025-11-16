const DEFAULT_CONFIG = {
    meta: {
        id: '',
        class: '',
        name: '',
        version: '0.5.3',
        author: '',
        notes: ''
    },
    mass: {
        mass_kg: 0,
        inertia_override: null
    },
    geometry: {
        bbox_m: {
            width: 0,
            length: 0
        },
        hull_radius_m: null
    },
    sprite: {
        path: '',
        size_px: { w: 0, h: 0 },
        pivot_px: { x: 0, y: 0 },
        orientation: 'nose_right',
        alpha_thr: 0,
        m_per_px: 0
    },
    propulsion: {
        main_engine_thrust_max_N: 0
    },
    rcs: {
        strafe_thrust_N: 0,
        turn_alpha_max_radps2: 0,
        turn_omega_max_radps: 0
    },
    g_limits: {
        profile: 'custom',
        longitudinal: {
            sustained_g: 0,
            burst_g: 0,
            burst_duration_s: 1,
            recovery_cooldown_s: 1
        },
        lateral: {
            sustained_g: 0,
            burst_g: 0,
            burst_duration_s: 1,
            recovery_cooldown_s: 1
        },
        behavior: {
            smoothing_tau_s: 0.1,
            blackout_model: 'none'
        }
    },
    assist: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 1,
        coupled_alpha_cap_radps2: 1,
        coupled_align_gain: 0.5,
        coupled_deadzone_deg: 2,
        autobrake_eps_mps: 0.05
    },
    spawn: {
        spawn_grace_seconds: 1
    },
    tags: []
};

function clone(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(target, source) {
    Object.keys(source).forEach((key) => {
        const srcVal = source[key];
        if (Array.isArray(srcVal)) {
            target[key] = srcVal.slice();
        } else if (isPlainObject(srcVal)) {
            if (!isPlainObject(target[key])) {
                target[key] = {};
            }
            mergeDeep(target[key], srcVal);
        } else {
            target[key] = srcVal;
        }
    });
    return target;
}

function ensureStructure(config) {
    const base = clone(DEFAULT_CONFIG);
    if (config && typeof config === 'object') {
        mergeDeep(base, config);
    }
    return base;
}

function getValueAtPath(obj, path) {
    return path.split('.').reduce((acc, part) => (acc === undefined ? undefined : acc?.[part]), obj);
}

function setValueAtPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (!isPlainObject(current[key])) {
            current[key] = {};
        }
        current = current[key];
    }
    current[parts[parts.length - 1]] = value;
}

function round(value, precision = 2) {
    const factor = 10 ** precision;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function tryParseNumber(value, allowNull = false) {
    if (value === '' || value === null || value === undefined) {
        return allowNull ? null : NaN;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? NaN : parsed;
}

function downloadFile(filename, contents) {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, 0);
}

function joinPath(base, addition) {
    if (!addition) {
        return base || '';
    }
    if (/^(?:[a-z]+:|\/\/)/i.test(addition)) {
        return addition;
    }
    const normalizedBase = (base || '').replace(/\\/g, '/');
    const normalizedAddition = addition.replace(/\\/g, '/');
    try {
        const root = new URL(normalizedBase || '.', 'http://editor.local/');
        const result = new URL(normalizedAddition, root);
        const href = result.href;
        if (href.startsWith('http://editor.local/')) {
            return decodeURIComponent(href.slice('http://editor.local/'.length));
        }
        return href;
    } catch {
        const prefix = normalizedBase.endsWith('/') || normalizedBase === '' ? normalizedBase : `${normalizedBase}/`;
        return `${prefix}${normalizedAddition}`.replace(/\/{2,}/g, '/');
    }
}

const GRAVITY = 9.80665;

function createGLimitPreset(longSustained, longBurst, longDuration, latSustained, latBurst, latDuration, smoothing) {
    const longRecovery = round(longDuration * 2.5, 2);
    const latRecovery = round(latDuration * 2.5, 2);
    return {
        longitudinal: {
            sustained_g: longSustained,
            burst_g: longBurst,
            burst_duration_s: longDuration,
            recovery_cooldown_s: longRecovery
        },
        lateral: {
            sustained_g: latSustained,
            burst_g: latBurst,
            burst_duration_s: latDuration,
            recovery_cooldown_s: latRecovery
        },
        behavior: {
            smoothing_tau_s: round(smoothing, 3),
            blackout_model: 'none'
        }
    };
}

const GLIMIT_PROFILE_PRESETS = {
    sport: createGLimitPreset(9, 12, 2.0, 7, 9, 1.5, 0.14),
    courier: createGLimitPreset(8, 11, 1.8, 6, 8, 1.3, 0.14),
    interceptor: createGLimitPreset(7, 9, 2.0, 5, 7, 1.5, 0.16),
    fighter: createGLimitPreset(6, 8, 2.0, 4, 6, 1.5, 0.18),
    'military.medium': createGLimitPreset(4, 6, 2.2, 3, 5, 2.0, 0.21),
    'military.heavy': createGLimitPreset(3, 5, 3.0, 2, 4, 2.5, 0.27),
    freighter: createGLimitPreset(2.5, 3.5, 2.5, 2.0, 3.0, 2.0, 0.26),
    passenger: createGLimitPreset(1.5, 2.5, 3.0, 1.2, 2.0, 2.0, 0.27),
    drone: createGLimitPreset(12, 18, 1.0, 9, 14, 0.8, 0.12)
};

const ASSIST_PRESETS = {
    sport: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 1.45,
        coupled_alpha_cap_radps2: 1.05,
        coupled_align_gain: 0.55,
        coupled_deadzone_deg: 2,
        autobrake_eps_mps: 0.08
    },
    courier: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 1.3,
        coupled_alpha_cap_radps2: 1.0,
        coupled_align_gain: 0.62,
        coupled_deadzone_deg: 3,
        autobrake_eps_mps: 0.1
    },
    interceptor: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 1.35,
        coupled_alpha_cap_radps2: 1.05,
        coupled_align_gain: 0.6,
        coupled_deadzone_deg: 3,
        autobrake_eps_mps: 0.08
    },
    fighter: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 1.2,
        coupled_alpha_cap_radps2: 0.9,
        coupled_align_gain: 0.6,
        coupled_deadzone_deg: 3,
        autobrake_eps_mps: 0.1
    },
    freighter: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 0.7,
        coupled_alpha_cap_radps2: 0.5,
        coupled_align_gain: 0.7,
        coupled_deadzone_deg: 4,
        autobrake_eps_mps: 0.1
    },
    passenger: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 0.8,
        coupled_alpha_cap_radps2: 0.55,
        coupled_align_gain: 0.72,
        coupled_deadzone_deg: 4,
        autobrake_eps_mps: 0.12
    },
    'military.medium': {
        coupled_enabled: true,
        coupled_omega_cap_radps: 0.9,
        coupled_alpha_cap_radps2: 0.7,
        coupled_align_gain: 0.65,
        coupled_deadzone_deg: 3,
        autobrake_eps_mps: 0.1
    },
    'military.heavy': {
        coupled_enabled: true,
        coupled_omega_cap_radps: 0.6,
        coupled_alpha_cap_radps2: 0.4,
        coupled_align_gain: 0.7,
        coupled_deadzone_deg: 4,
        autobrake_eps_mps: 0.1
    },
    drone: {
        coupled_enabled: true,
        coupled_omega_cap_radps: 1.6,
        coupled_alpha_cap_radps2: 1.1,
        coupled_align_gain: 0.5,
        coupled_deadzone_deg: 2,
        autobrake_eps_mps: 0.05
    }
};

const SPRITE_ALPHA_DEFAULTS = {
    default: 16,
    fighter: 16,
    courier: 16,
    interceptor: 14,
    sport: 14,
    freighter: 24,
    passenger: 18,
    'military.medium': 20,
    'military.heavy': 24,
    drone: 12
};

function computeHullRadius(editor) {
    const width = Number(editor.config.geometry?.bbox_m?.width);
    const length = Number(editor.config.geometry?.bbox_m?.length);
    if (!width || !length) {
        return { error: 'Fill bounding box width and length first.' };
    }
    const radius = round(Math.sqrt((width / 2) ** 2 + (length / 2) ** 2), 3);
    return {
        patch: { 'geometry.hull_radius_m': radius },
        message: `Hull radius set to ${radius} m`
    };
}

function computeInertiaOverride(editor) {
    const mass = Number(editor.config.mass?.mass_kg);
    const width = Number(editor.config.geometry?.bbox_m?.width);
    const length = Number(editor.config.geometry?.bbox_m?.length);
    if (!mass || !width || !length) {
        return { error: 'Mass and bounding box are required for inertia override.' };
    }
    const izz = round((mass * ((width ** 2) + (length ** 2))) / 12, 3);
    return {
        patch: { 'mass.inertia_override.Izz_kg_m2': izz },
        message: `Izz override set to ${izz} kg*m^2`
    };
}

function computeSpriteSize(editor) {
    if (!editor.spriteImage) {
        return { error: 'Load the sprite file first.' };
    }
    const w = editor.spriteImage.naturalWidth;
    const h = editor.spriteImage.naturalHeight;
    return {
        patch: {
            'sprite.size_px.w': w,
            'sprite.size_px.h': h
        },
        message: `Sprite size updated to ${w}x${h} px`
    };
}

function computeSpritePivot(editor) {
    const w = Number(editor.config.sprite?.size_px?.w);
    const h = Number(editor.config.sprite?.size_px?.h);
    if (!w || !h) {
        return { error: 'Sprite width and height are required.' };
    }
    const pivotX = round(w / 2, 2);
    const pivotY = round(h / 2, 2);
    return {
        patch: {
            'sprite.pivot_px.x': pivotX,
            'sprite.pivot_px.y': pivotY
        },
        message: `Pivot centered at ${pivotX}, ${pivotY} px`
    };
}

function computeSpriteScale(editor) {
    const length = Number(editor.config.geometry?.bbox_m?.length);
    const width = Number(editor.config.geometry?.bbox_m?.width);
    const w = Number(editor.config.sprite?.size_px?.w);
    const h = Number(editor.config.sprite?.size_px?.h);
    if (!length || !width || !w || !h) {
        return { error: 'Fill geometry and sprite size before computing scale.' };
    }
    const orientation = editor.config.sprite?.orientation || 'nose_right';
    let primaryMeters;
    let primaryPixels;
    let secondaryMeters;
    let secondaryPixels;
    if (orientation === 'nose_up' || orientation === 'nose_down') {
        primaryMeters = length;
        primaryPixels = h;
        secondaryMeters = width;
        secondaryPixels = w;
    } else {
        primaryMeters = length;
        primaryPixels = w;
        secondaryMeters = width;
        secondaryPixels = h;
    }
    const scales = [];
    if (primaryMeters > 0 && primaryPixels > 0) {
        scales.push(primaryMeters / primaryPixels);
    }
    if (secondaryMeters > 0 && secondaryPixels > 0) {
        scales.push(secondaryMeters / secondaryPixels);
    }
    if (scales.length === 0) {
        return { error: 'Unable to derive meters per pixel from provided values.' };
    }
    const average = round(scales.reduce((sum, value) => sum + value, 0) / scales.length, 5);
    return {
        patch: { 'sprite.m_per_px': average },
        message: `Meters per pixel set to ${average}`
    };
}

function computeMainThrust(editor) {
    const mass = Number(editor.config.mass?.mass_kg);
    const sustained = Number(editor.config.g_limits?.longitudinal?.sustained_g);
    if (!mass || !sustained) {
        return { error: 'Mass and longitudinal sustained g are required for thrust estimation.' };
    }
    const thrust = Math.round(mass * GRAVITY * sustained);
    return {
        patch: { 'propulsion.main_engine_thrust_max_N': thrust },
        message: `Main thrust set to ${thrust} N`
    };
}

function computeStrafeThrust(editor) {
    const mass = Number(editor.config.mass?.mass_kg);
    const sustained = Number(editor.config.g_limits?.lateral?.sustained_g);
    if (!mass || !sustained) {
        return { error: 'Mass and lateral sustained g are required for strafe thrust.' };
    }
    const thrust = Math.round(mass * GRAVITY * sustained);
    return {
        patch: { 'rcs.strafe_thrust_N': thrust },
        message: `Strafe thrust set to ${thrust} N`
    };
}

function recommendSpritePath(editor) {
    const fallbackName = editor.spriteSource?.name
        || (editor.config.sprite?.path || '').split('/').pop();
    if (!fallbackName) {
        return { error: 'Load or specify a sprite to compute a path.' };
    }
    const next = editor.inferPreferredSpritePath(fallbackName, editor.config.sprite?.path);
    return {
        patch: { 'sprite.path': next },
        message: `Sprite path set to ${next}`
    };
}

function recommendSpriteAlpha(editor) {
    const classKey = (editor.config.meta?.class || '').toLowerCase();
    const preset = SPRITE_ALPHA_DEFAULTS[classKey] ?? SPRITE_ALPHA_DEFAULTS.default;
    const mass = Number(editor.config.mass?.mass_kg);
    const value = mass && mass > 150000 ? 24 : preset;
    return {
        patch: { 'sprite.alpha_thr': value },
        message: `Alpha threshold set to ${value}`
    };
}

function recommendGLimits(editor, scope = 'all') {
    const profileKey = (editor.config.g_limits?.profile || editor.config.meta?.class || '').toLowerCase();
    const preset = GLIMIT_PROFILE_PRESETS[profileKey];
    if (!preset) {
        return { error: 'Set g_limits.profile to a known preset before applying recommendations.' };
    }
    const patch = {};
    if (scope === 'longitudinal' || scope === 'all') {
        Object.entries(preset.longitudinal).forEach(([key, value]) => {
            patch[`g_limits.longitudinal.${key}`] = value;
        });
    }
    if (scope === 'lateral' || scope === 'all') {
        Object.entries(preset.lateral).forEach(([key, value]) => {
            patch[`g_limits.lateral.${key}`] = value;
        });
    }
    if (scope === 'behavior' || scope === 'all') {
        Object.entries(preset.behavior).forEach(([key, value]) => {
            patch[`g_limits.behavior.${key}`] = value;
        });
    }
    return {
        patch,
        message: `Applied ${profileKey || 'profile'} g-limit preset`
    };
}

function recommendAssist(editor) {
    const classKey = (editor.config.meta?.class || editor.config.g_limits?.profile || '').toLowerCase();
    let preset = ASSIST_PRESETS[classKey];
    if (!preset) {
        const rcs = editor.config.rcs || {};
        const latG = Number(editor.config.g_limits?.lateral?.sustained_g) || 0;
        const agility = Math.max(0, Math.min(1, (latG - 2) / 5));
        const omega = rcs.turn_omega_max_radps
            ? round(rcs.turn_omega_max_radps * (0.75 + 0.2 * agility), 2)
            : round(1.0 + 0.6 * agility, 2);
        const alpha = rcs.turn_alpha_max_radps2
            ? round(rcs.turn_alpha_max_radps2 * (0.75 + 0.2 * agility), 2)
            : round(0.6 + 0.6 * agility, 2);
        const align = round(0.55 + 0.25 * (1 - agility), 2);
        const deadzone = Math.max(2, Math.round(2 + 2 * (1 - agility)));
        const autobrake = round(0.08 + 0.05 * (1 - agility), 3);
        preset = {
            coupled_enabled: true,
            coupled_omega_cap_radps: omega,
            coupled_alpha_cap_radps2: alpha,
            coupled_align_gain: align,
            coupled_deadzone_deg: deadzone,
            autobrake_eps_mps: autobrake
        };
    }
    const patch = {};
    Object.entries(preset).forEach(([key, value]) => {
        patch[`assist.${key}`] = value;
    });
    return {
        patch,
        message: 'Assist parameters updated from preset'
    };
}

function recommendSpawnGrace(editor) {
    const mass = Number(editor.config.mass?.mass_kg) || 0;
    const base = mass > 100000 ? 3.5 : mass > 50000 ? 2.5 : 2.0;
    const value = round(base, 2);
    return {
        patch: { 'spawn.spawn_grace_seconds': value },
        message: `Spawn grace set to ${value} s`
    };
}

const FIELD_METADATA = {
    'meta.id': {
        help: 'Persistent ship identifier. Keep it unique, lowercase, and safe for filenames.'
    },
    'meta.class': {
        help: 'Ship class keyword (fighter, courier, freighter, etc). Used to look up presets and folders.'
    },
    'meta.name': {
        help: 'Optional display name shown in UI and debug tools.'
    },
    'meta.version': {
        help: 'Ship config version tag. Usually matches the game build (e.g. 0.5.3).'
    },
    'meta.author': {
        help: 'Optional author credit for the configuration.'
    },
    'meta.notes': {
        help: 'Designer notes. Free-form text ignored by runtime systems.'
    },
    'mass.mass_kg': {
        help: 'Total ship mass in kilograms. Affects thrust requirements, g-limits, and physics.'
    },
    'mass.inertia_override.Izz_kg_m2': {
        help: 'Optional override for the Z-axis moment of inertia (kg*m^2). Leave empty to use the physics approximation.',
        compute: computeInertiaOverride
    },
    'geometry.bbox_m.width': {
        help: 'Bounding box width in meters (aligned with ship Y axis). Used for collisions and scaling.'
    },
    'geometry.bbox_m.length': {
        help: 'Bounding box length in meters (aligned with ship X axis).'
    },
    'geometry.hull_radius_m': {
        help: 'Optional hull radius in meters. If omitted it can be inferred from the bounding box.',
        compute: computeHullRadius
    },
    'sprite.path': {
        help: 'Relative path to the sprite texture. The editor resolves it against the ship file location and the project root.',
        recommend: recommendSpritePath
    },
    'sprite.size_px.w': {
        help: 'Sprite pixel width. Automatically detected from the source image.',
        compute: computeSpriteSize
    },
    'sprite.size_px.h': {
        help: 'Sprite pixel height. Automatically detected from the source image.',
        compute: computeSpriteSize
    },
    'sprite.pivot_px.x': {
        help: 'Sprite pivot X coordinate in pixels. Click the preview to place it.',
        compute: computeSpritePivot
    },
    'sprite.pivot_px.y': {
        help: 'Sprite pivot Y coordinate in pixels.',
        compute: computeSpritePivot
    },
    'sprite.orientation': {
        help: 'Sprite orientation relative to ship axes. Determines how length/width align to pixels.'
    },
    'sprite.alpha_thr': {
        help: 'Alpha threshold (0-255). Pixels with alpha below the value are ignored when building tight hull masks.',
        recommend: recommendSpriteAlpha
    },
    'sprite.m_per_px': {
        help: 'Meters represented by one sprite pixel. Drives zoom and collision fit. Can be derived from geometry and sprite size.',
        compute: computeSpriteScale
    },
    'propulsion.main_engine_thrust_max_N': {
        help: 'Maximum continuous main engine thrust in newtons.',
        compute: computeMainThrust
    },
    'rcs.strafe_thrust_N': {
        help: 'Total lateral RCS thrust in newtons. Should support the lateral sustained g-limit.',
        compute: computeStrafeThrust
    },
    'rcs.turn_alpha_max_radps2': {
        help: 'Maximum angular acceleration (rad/s^2) deliverable by the RCS.'
    },
    'rcs.turn_omega_max_radps': {
        help: 'Maximum angular velocity (rad/s) the ship can sustain with RCS.'
    },
    'g_limits.profile': {
        help: 'Profile keyword for g-limit presets (sport, courier, fighter, freighter, etc).'
    },
    'g_limits.longitudinal.sustained_g': {
        help: 'Forward/backward sustained g before fatigue.',
        recommend: (editor) => recommendGLimits(editor, 'longitudinal')
    },
    'g_limits.longitudinal.burst_g': {
        help: 'Forward/backward burst g allowed for short periods.',
        recommend: (editor) => recommendGLimits(editor, 'longitudinal')
    },
    'g_limits.longitudinal.burst_duration_s': {
        help: 'Duration in seconds that burst g can be maintained.',
        recommend: (editor) => recommendGLimits(editor, 'longitudinal')
    },
    'g_limits.longitudinal.recovery_cooldown_s': {
        help: 'Cooldown in seconds before the pilot can re-enter burst g.',
        recommend: (editor) => recommendGLimits(editor, 'longitudinal')
    },
    'g_limits.lateral.sustained_g': {
        help: 'Lateral sustained g limit.',
        recommend: (editor) => recommendGLimits(editor, 'lateral')
    },
    'g_limits.lateral.burst_g': {
        help: 'Lateral burst g limit.',
        recommend: (editor) => recommendGLimits(editor, 'lateral')
    },
    'g_limits.lateral.burst_duration_s': {
        help: 'Burst duration for lateral g.',
        recommend: (editor) => recommendGLimits(editor, 'lateral')
    },
    'g_limits.lateral.recovery_cooldown_s': {
        help: 'Recovery cooldown after lateral burst g.',
        recommend: (editor) => recommendGLimits(editor, 'lateral')
    },
    'g_limits.behavior.smoothing_tau_s': {
        help: 'Time constant (seconds) for smoothing g-limit transitions.',
        recommend: (editor) => recommendGLimits(editor, 'behavior')
    },
    'g_limits.behavior.blackout_model': {
        help: 'Blackout model identifier (none, basic, gritty).'
    },
    'assist.coupled_enabled': {
        help: 'If true, coupled flight mode is enabled by default.',
        recommend: recommendAssist
    },
    'assist.coupled_omega_cap_radps': {
        help: 'Coupled flight angular velocity clamp (rad/s).',
        recommend: recommendAssist
    },
    'assist.coupled_alpha_cap_radps2': {
        help: 'Coupled flight angular acceleration clamp (rad/s^2).',
        recommend: recommendAssist
    },
    'assist.coupled_align_gain': {
        help: 'Align-to-velocity proportional gain for the coupled autopilot.',
        recommend: recommendAssist
    },
    'assist.coupled_deadzone_deg': {
        help: 'Degrees around target heading where the autopilot stops correcting.',
        recommend: recommendAssist
    },
    'assist.autobrake_eps_mps': {
        help: 'Velocity threshold (m/s) the autopilot treats as stopped.',
        recommend: recommendAssist
    },
    'spawn.spawn_grace_seconds': {
        help: 'Invulnerability and collision grace period after spawning (seconds).',
        recommend: recommendSpawnGrace
    }
};

class ShipConfigEditor {
    constructor() {
        this.config = ensureStructure();
        this.fileHandle = null;
        this.fileLabel = 'offline';
        this.spriteImage = null;
        this.spriteSource = null;
        this.spriteObjectUrl = null;
        this.configSource = null;
        this.currentConfigPath = null;
        this.currentConfigDirHint = null;
        this.elements = this.collectElements();
        this.pathInputs = this.mapPathInputs();
        this.helpPanels = new Map();
        this.bindEvents();
        this.setupFieldEnhancements();
        this.populateForm();
        this.renderTags();
        this.updateInertiaToggle();
        this.updateSpriteFromConfig(true);
        this.refreshOutputs();
    }

    collectElements() {
        const root = document;
        return {
            form: root.getElementById('shipForm'),
            loadStatus: root.getElementById('loadStatus'),
            btnLoadAppConfig: root.getElementById('btnLoadAppConfig'),
            btnOpenFile: root.getElementById('btnOpenFile'),
            btnSave: root.getElementById('btnSave'),
            btnSaveAs: root.getElementById('btnSaveAs'),
            btnLoadSprite: root.getElementById('btnLoadSprite'),
            btnAddTag: root.getElementById('btnAddTag'),
            btnCopyJson: root.getElementById('btnCopyJson'),
            openFileInput: root.getElementById('openFileInput'),
            spriteFileInput: root.getElementById('spriteFileInput'),
            tagInput: root.getElementById('tagInput'),
            tagList: root.getElementById('tagList'),
            messageList: root.getElementById('messageList'),
            statusText: root.getElementById('statusText'),
            spriteCanvas: root.getElementById('spriteCanvas'),
            spriteSummary: root.getElementById('spriteSummary'),
            spriteSummaryContent: root.getElementById('spriteSummaryContent'),
            previewScale: root.getElementById('previewScale'),
            jsonPreview: root.getElementById('jsonPreview'),
            enableInertia: root.getElementById('enableInertia'),
            inertiaField: root.getElementById('inertiaField')
        };
    }

    mapPathInputs() {
        const map = new Map();
        this.elements.form.querySelectorAll('[data-path]').forEach((input) => {
            map.set(input.dataset.path, input);
        });
        return map;
    }

    bindEvents() {
        this.elements.form.addEventListener('submit', (event) => event.preventDefault());
        this.elements.form.addEventListener('input', (event) => this.handleInput(event));
        this.elements.form.addEventListener('change', (event) => this.handleInput(event));

        this.elements.btnLoadAppConfig.addEventListener('click', () => this.loadFromAppConfig());
        this.elements.btnOpenFile.addEventListener('click', () => this.openFile());
        this.elements.btnSave.addEventListener('click', () => this.save(false));
        this.elements.btnSaveAs.addEventListener('click', () => this.save(true));
        this.elements.btnLoadSprite.addEventListener('click', () => this.elements.spriteFileInput.click());
        this.elements.btnAddTag.addEventListener('click', () => this.addTag());
        this.elements.btnCopyJson.addEventListener('click', () => this.copyJson());

        this.elements.openFileInput.addEventListener('change', (event) => this.handleFileInput(event));
        this.elements.spriteFileInput.addEventListener('change', (event) => this.handleSpriteInput(event));
        this.elements.previewScale.addEventListener('input', () => this.drawSprite());
        this.elements.enableInertia.addEventListener('change', () => this.toggleInertiaOverride());

        this.elements.spriteCanvas.addEventListener('click', (event) => this.handleSpriteClick(event));

        this.handleDocumentClick = (event) => {
            if (event.target.closest('.field') || event.target.closest('.help-button')) {
                return;
            }
            this.closeAllHelp();
        };
        document.addEventListener('click', this.handleDocumentClick);
    }

    setupFieldEnhancements() {
        this.pathInputs.forEach((input, path) => {
            const meta = FIELD_METADATA[path];
            if (!meta) {
                return;
            }
            const field = input.closest('.field');
            if (!field) {
                return;
            }
            field.classList.add('field-enhanced');
            const label = field.querySelector(`label[for="${input.id}"]`) || field.querySelector('label');
            if (meta.help && label) {
                label.classList.add('field-label');
                const helpButton = document.createElement('button');
                helpButton.type = 'button';
                helpButton.className = 'help-button';
                helpButton.textContent = 'i';
                helpButton.setAttribute('aria-label', 'Show help');
                helpButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.toggleHelp(path);
                });
                label.appendChild(helpButton);
                let helpPanel = field.querySelector('.field-help');
                if (!helpPanel) {
                    helpPanel = document.createElement('div');
                    helpPanel.className = 'field-help';
                    field.appendChild(helpPanel);
                }
                helpPanel.innerHTML = meta.help;
                this.helpPanels.set(path, { field, panel: helpPanel });
            }
            const actions = document.createElement('div');
            actions.className = 'field-actions';
            let hasActions = false;
            if (meta.compute) {
                const autoBtn = this.createFieldActionButton('Auto', 'Вычислить автоматически', () => this.applyFieldAction(meta.compute, path, 'compute'));
                actions.appendChild(autoBtn);
                hasActions = true;
            }
            if (meta.recommend) {
                const recBtn = this.createFieldActionButton('Rec', 'Установить рекомендуемые', () => this.applyFieldAction(meta.recommend, path, 'recommend'));
                actions.appendChild(recBtn);
                hasActions = true;
            }
            if (hasActions) {
                field.appendChild(actions);
            }
        });
    }

    createFieldActionButton(label, title, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.title = title;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handler();
        });
        return button;
    }

    toggleHelp(path) {
        const target = this.helpPanels.get(path);
        if (!target) {
            return;
        }
        const shouldOpen = !target.field.classList.contains('help-open');
        this.helpPanels.forEach(({ field }) => field.classList.remove('help-open'));
        target.field.classList.toggle('help-open', shouldOpen);
    }

    closeAllHelp() {
        this.helpPanels.forEach(({ field }) => field.classList.remove('help-open'));
    }

    handleInput(event) {
        const target = event.target;
        if (!target || !target.dataset || !target.dataset.path) {
            return;
        }
        const { path } = target.dataset;
        const isCheckbox = target.type === 'checkbox';
        const nullable = target.dataset.nullable === 'true';
        let value;
        if (isCheckbox) {
            value = target.checked;
        } else if (target.type === 'number') {
            const parsed = tryParseNumber(target.value, nullable);
            if (Number.isNaN(parsed)) {
                return;
            }
            value = parsed;
        } else {
            value = target.value;
        }
        if (!isCheckbox && nullable && target.value.trim() === '') {
            value = null;
        }
        setValueAtPath(this.config, path, value);
        if (path.startsWith('sprite.')) {
            const force = path === 'sprite.path';
            this.updateSpriteFromConfig(force, path);
        }
        if (path.startsWith('mass.inertia_override')) {
            this.updateInertiaToggle();
        }
        this.refreshOutputs();
    }

    refreshOutputs() {
        this.updateJsonPreview();
        this.runValidation();
        this.updateSpriteSummary();
    }

    populateForm() {
        this.pathInputs.forEach((input, path) => {
            const value = getValueAtPath(this.config, path);
            if (input.type === 'checkbox') {
                input.checked = Boolean(value);
            } else if (input.type === 'number') {
                input.value = value === null || value === undefined ? '' : value;
            } else {
                input.value = value ?? '';
            }
        });
        this.updateInertiaToggle();
    }

    updateInputDisplay(path) {
        const input = this.pathInputs.get(path);
        if (!input) {
            return;
        }
        const value = getValueAtPath(this.config, path);
        if (input.type === 'checkbox') {
            input.checked = Boolean(value);
        } else if (input.type === 'number') {
            input.value = value === null || value === undefined ? '' : value;
        } else {
            input.value = value ?? '';
        }
    }

    toggleInertiaOverride() {
        if (this.elements.enableInertia.checked) {
            const current = this.config.mass.inertia_override;
            const defaultValue = current && typeof current.Izz_kg_m2 === 'number'
                ? current.Izz_kg_m2
                : this.config.mass.mass_kg;
            setValueAtPath(this.config, 'mass.inertia_override', { Izz_kg_m2: defaultValue });
        } else {
            setValueAtPath(this.config, 'mass.inertia_override', null);
        }
        this.updateInertiaToggle();
        this.refreshOutputs();
    }

    updateInertiaToggle() {
        const override = this.config.mass.inertia_override;
        const enabled = override !== null && override !== undefined;
        this.elements.enableInertia.checked = enabled;
        const fieldInput = this.elements.inertiaField.querySelector('input');
        fieldInput.disabled = !enabled;
        if (enabled) {
            fieldInput.value = override?.Izz_kg_m2 ?? '';
        } else {
            fieldInput.value = '';
        }
    }

    addTag() {
        const raw = this.elements.tagInput.value.trim();
        if (!raw) {
            return;
        }
        if (!Array.isArray(this.config.tags)) {
            this.config.tags = [];
        }
        if (!this.config.tags.includes(raw)) {
            this.config.tags.push(raw);
        }
        this.elements.tagInput.value = '';
        this.renderTags();
        this.refreshOutputs();
    }

    removeTag(tag) {
        this.config.tags = (this.config.tags || []).filter((item) => item !== tag);
        this.renderTags();
        this.refreshOutputs();
    }

    renderTags() {
        const container = this.elements.tagList;
        container.innerHTML = '';
        if (!Array.isArray(this.config.tags) || this.config.tags.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.style.color = 'var(--text-dim)';
            placeholder.style.fontSize = '0.8rem';
            placeholder.textContent = 'No tags yet';
            container.appendChild(placeholder);
            return;
        }
        this.config.tags.forEach((tag) => {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = tag;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
            removeBtn.textContent = 'x';
            removeBtn.addEventListener('click', () => this.removeTag(tag));
            badge.appendChild(removeBtn);
            container.appendChild(badge);
        });
    }

    async loadFromAppConfig() {
        try {
            const appResponse = await fetch('./config/app.json');
            if (!appResponse.ok) {
                throw new Error(`app.json: ${appResponse.status}`);
            }
            const appConfig = await appResponse.json();
            const shipPath = appConfig?.paths?.ship_config_path;
            if (!shipPath) {
                throw new Error('ship_config_path is missing');
            }
            const shipUrl = new URL(shipPath, window.location.href);
            const shipResponse = await fetch(shipUrl.href);
            if (!shipResponse.ok) {
                throw new Error(`${shipPath}: ${shipResponse.status}`);
            }
            const shipConfig = await shipResponse.json();
            this.setRemoteConfigSource(shipPath);
            this.setConfig(shipConfig);
            this.fileHandle = null;
            this.setLoadStatus(`app: ${shipPath}`);
            this.setStatus('Loaded ship config from app.json');
        } catch (error) {
            console.error(error);
            this.setStatus(`Failed to load ship config: ${error.message}`, 'error');
        }
    }

    async openFile() {
        if (window.showOpenFilePicker) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'ShipConfig JSON',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const file = await handle.getFile();
                const text = await file.text();
                const config = JSON.parse(text);
                this.setHandleConfigSource(handle);
                this.setConfig(config);
                this.setLoadStatus(`file: ${handle.name}`);
                this.setStatus(`Opened file ${handle.name}`);
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    console.error(error);
                    this.setStatus(`Failed to open file: ${error.message}`, 'error');
                }
            }
        } else {
            this.elements.openFileInput.click();
        }
    }

    handleFileInput(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const config = JSON.parse(reader.result);
                this.setLooseConfigSource(file.name);
                this.setConfig(config);
                this.setLoadStatus(`file: ${file.name}`);
                this.setStatus(`Opened file ${file.name}`);
            } catch (error) {
                console.error(error);
                this.setStatus('File does not look like a valid ShipConfig', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    async save(forceSaveAs = false) {
        const prepared = this.prepareForSave();
        const json = JSON.stringify(prepared, null, 2);
        if (window.showSaveFilePicker) {
            let handle = this.fileHandle;
            if (!handle || forceSaveAs) {
                try {
                    handle = await window.showSaveFilePicker({
                        suggestedName: `${prepared.meta.id || 'ship'}.json`,
                        types: [{
                            description: 'ShipConfig JSON',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });
                } catch (error) {
                    if (error?.name !== 'AbortError') {
                        this.setStatus(`Failed to open save dialog: ${error.message}`, 'error');
                    }
                    return;
                }
            }
            try {
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                this.setHandleConfigSource(handle);
                this.setLoadStatus(`file: ${handle.name}`);
                this.setStatus(`Saved to ${handle.name}`);
            } catch (error) {
                console.error(error);
                this.setStatus(`Failed to save file: ${error.message}`, 'error');
            }
        } else {
            const filename = `${prepared.meta.id || 'ship'}.json`;
            downloadFile(filename, json);
            this.setLooseConfigSource(filename);
            this.setStatus(`Exported file ${filename}`);
        }
    }

    prepareForSave() {
        const cloneConfig = ensureStructure(this.config);
        const optionalMetaKeys = ['name', 'version', 'author', 'notes'];
        optionalMetaKeys.forEach((key) => {
            if (cloneConfig.meta[key] === '' || cloneConfig.meta[key] === null) {
                delete cloneConfig.meta[key];
            }
        });
        if (cloneConfig.mass.inertia_override) {
            const { Izz_kg_m2 } = cloneConfig.mass.inertia_override;
            if (Izz_kg_m2 === null || Izz_kg_m2 === undefined || Number.isNaN(Izz_kg_m2)) {
                cloneConfig.mass.inertia_override = null;
            }
        }
        if (cloneConfig.geometry.hull_radius_m === null || cloneConfig.geometry.hull_radius_m === undefined || cloneConfig.geometry.hull_radius_m === '') {
            delete cloneConfig.geometry.hull_radius_m;
        }
        cloneConfig.sprite.path = (cloneConfig.sprite.path || '').replace(/\\/g, '/');
        cloneConfig.tags = (cloneConfig.tags || []).filter((tag) => tag && tag.trim().length > 0);
        return cloneConfig;
    }

    setConfig(config) {
        this.config = ensureStructure(config);
        this.populateForm();
        this.renderTags();
        this.updateSpriteFromConfig(true);
        this.refreshOutputs();
    }

    setStatus(message, type = 'info') {
        this.elements.statusText.textContent = message;
        if (type === 'error') {
            this.elements.statusText.style.color = 'var(--danger)';
        } else if (type === 'warn') {
            this.elements.statusText.style.color = '#ffd992';
        } else {
            this.elements.statusText.style.color = 'var(--accent-strong)';
        }
    }

    setLoadStatus(label) {
        this.fileLabel = label;
        this.elements.loadStatus.textContent = label;
    }

    updateJsonPreview() {
        const preview = JSON.stringify(this.prepareForSave(), null, 2);
        this.elements.jsonPreview.value = preview;
    }

    runValidation() {
        const result = this.validateConfig();
        this.displayMessages(result);
        this.updateInvalidStates(result.errors);
    }

    validateConfig() {
        const errors = [];
        const warnings = [];
        const cfg = this.config;

        if (!cfg.meta.id?.trim()) {
            errors.push({ path: 'meta.id', message: 'meta.id is required' });
        }
        if (!cfg.meta.class?.trim()) {
            errors.push({ path: 'meta.class', message: 'meta.class is required' });
        }
        if ((cfg.mass.mass_kg ?? 0) <= 0) {
            errors.push({ path: 'mass.mass_kg', message: 'mass.mass_kg must be greater than zero' });
        }
        if ((cfg.geometry.bbox_m.width ?? 0) <= 0) {
            errors.push({ path: 'geometry.bbox_m.width', message: 'geometry.bbox_m.width must be greater than zero' });
        }
        if ((cfg.geometry.bbox_m.length ?? 0) <= 0) {
            errors.push({ path: 'geometry.bbox_m.length', message: 'geometry.bbox_m.length must be greater than zero' });
        }
        if ((cfg.sprite.m_per_px ?? 0) <= 0) {
            errors.push({ path: 'sprite.m_per_px', message: 'sprite.m_per_px must be greater than zero' });
        }
        if ((cfg.sprite.size_px.w ?? 0) <= 0) {
            warnings.push({ path: 'sprite.size_px.w', message: 'Sprite width is not set' });
        }
        if ((cfg.sprite.size_px.h ?? 0) <= 0) {
            warnings.push({ path: 'sprite.size_px.h', message: 'Sprite height is not set' });
        }
        if ((cfg.propulsion.main_engine_thrust_max_N ?? 0) <= 0) {
            warnings.push({ path: 'propulsion.main_engine_thrust_max_N', message: 'Main engine thrust is not set' });
        }
        if ((cfg.rcs.strafe_thrust_N ?? 0) <= 0) {
            warnings.push({ path: 'rcs.strafe_thrust_N', message: 'RCS strafe thrust is not set' });
        }
        if ((cfg.rcs.turn_alpha_max_radps2 ?? 0) <= 0) {
            warnings.push({ path: 'rcs.turn_alpha_max_radps2', message: 'RCS turn alpha limit is not set' });
        }
        if ((cfg.rcs.turn_omega_max_radps ?? 0) <= 0) {
            warnings.push({ path: 'rcs.turn_omega_max_radps', message: 'RCS turn omega limit is not set' });
        }

        const gl = cfg.g_limits;
        if (gl) {
            const sections = [
                { path: 'g_limits.longitudinal', data: gl.longitudinal, label: 'Longitudinal' },
                { path: 'g_limits.lateral', data: gl.lateral, label: 'Lateral' }
            ];
            sections.forEach(({ path, data, label }) => {
                if (!data) {
                    errors.push({ path, message: `${label} g-limits section is missing` });
                    return;
                }
                if ((data.sustained_g ?? 0) <= 0) {
                    errors.push({ path: `${path}.sustained_g`, message: `${label} sustained_g must be greater than zero` });
                }
                if ((data.burst_g ?? 0) < (data.sustained_g ?? 0)) {
                    errors.push({ path: `${path}.burst_g`, message: `${label} burst_g must be >= sustained_g` });
                }
                if ((data.burst_duration_s ?? 0) <= 0) {
                    errors.push({ path: `${path}.burst_duration_s`, message: `${label} burst_duration_s must be greater than zero` });
                }
                if ((data.recovery_cooldown_s ?? 0) < (data.burst_duration_s ?? 0)) {
                    warnings.push({ path: `${path}.recovery_cooldown_s`, message: `${label} recovery_cooldown_s is usually >= burst_duration_s` });
                }
            });
            if ((gl.behavior?.smoothing_tau_s ?? 0) <= 0) {
                errors.push({ path: 'g_limits.behavior.smoothing_tau_s', message: 'g_limits.behavior.smoothing_tau_s must be greater than zero' });
            }
        } else {
            errors.push({ path: 'g_limits', message: 'g_limits section is missing' });
        }

        if ((cfg.spawn.spawn_grace_seconds ?? 0) < 0) {
            errors.push({ path: 'spawn.spawn_grace_seconds', message: 'spawn.spawn_grace_seconds cannot be negative' });
        }

        return { errors, warnings };
    }

    displayMessages({ errors, warnings }) {
        const container = this.elements.messageList;
        container.innerHTML = '';
        const renderItem = (item, type) => {
            const div = document.createElement('div');
            div.className = `message ${type}`;
            div.textContent = item.message;
            container.appendChild(div);
        };
        errors.forEach((item) => renderItem(item, 'error'));
        warnings.forEach((item) => renderItem(item, 'warn'));
        if (errors.length === 0 && warnings.length === 0) {
            const ok = document.createElement('div');
            ok.className = 'message';
            ok.style.background = 'rgba(62,136,255,0.12)';
            ok.style.border = '1px solid rgba(62,136,255,0.3)';
            ok.style.color = 'var(--accent-strong)';
            ok.textContent = 'Config looks valid';
            container.appendChild(ok);
        }
    }

    updateInvalidStates(errors) {
        this.pathInputs.forEach((input) => {
            input.classList.remove('invalid');
        });
        errors.forEach((error) => {
            const input = this.pathInputs.get(error.path);
            if (input) {
                input.classList.add('invalid');
            }
        });
    }

    async handleSpriteInput(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            this.setSpriteImage(image, { type: 'file', url: objectUrl, name: file.name });
            setValueAtPath(this.config, 'sprite.size_px.w', image.naturalWidth);
            setValueAtPath(this.config, 'sprite.size_px.h', image.naturalHeight);
            if (!this.config.sprite.pivot_px.x && !this.config.sprite.pivot_px.y) {
                setValueAtPath(this.config, 'sprite.pivot_px.x', round(image.naturalWidth / 2, 2));
                setValueAtPath(this.config, 'sprite.pivot_px.y', round(image.naturalHeight / 2, 2));
            }
            const preferredPath = this.inferPreferredSpritePath(file.name, this.config.sprite.path);
            setValueAtPath(this.config, 'sprite.path', preferredPath);
            this.updateInputDisplay('sprite.size_px.w');
            this.updateInputDisplay('sprite.size_px.h');
            this.updateInputDisplay('sprite.pivot_px.x');
            this.updateInputDisplay('sprite.pivot_px.y');
            this.updateInputDisplay('sprite.path');
            this.drawSprite();
            this.refreshOutputs();
            this.setStatus(`Loaded sprite file ${file.name}`);
        };
        image.onerror = () => {
            this.setStatus('Failed to read sprite image', 'error');
            URL.revokeObjectURL(objectUrl);
        };
        image.src = objectUrl;
        event.target.value = '';
    }

    setSpriteImage(image, sourceInfo) {
        if (this.spriteObjectUrl) {
            URL.revokeObjectURL(this.spriteObjectUrl);
            this.spriteObjectUrl = null;
        }
        this.spriteImage = image;
        this.spriteSource = { ...sourceInfo };
        if (sourceInfo.type === 'file') {
            this.spriteObjectUrl = sourceInfo.url;
        }
        this.drawSprite();
    }

    updateSpriteFromConfig(force = false, changedPath = '') {
        const spritePath = (this.config.sprite?.path || '').trim();
        if (!spritePath) {
            this.spriteImage = null;
            this.drawSprite();
            this.updateSpriteSummary();
            return;
        }
        if (!force && this.spriteSource?.type === 'file' && changedPath !== 'sprite.path') {
            this.drawSprite();
            return;
        }
        if (!force && this.spriteSource?.type === 'path' && this.spriteSource.originalPath === spritePath) {
            this.drawSprite();
            return;
        }
        const candidates = this.resolveSpriteCandidates(spritePath);
        if (candidates.length === 0) {
            this.spriteImage = null;
            this.drawSprite();
            this.updateSpriteSummary();
            return;
        }
        this.loadSpriteFromCandidates(candidates, 0, spritePath);
    }

    resolveSpriteCandidates(spritePath) {
        const candidates = [];
        const add = (value) => {
            if (!value) {
                return;
            }
            if (!candidates.includes(value)) {
                candidates.push(value);
            }
        };
        if (/^(data:|https?:|\/\/)/i.test(spritePath)) {
            add(spritePath);
            return candidates;
        }
        add(spritePath);
        if (this.configSource?.type === 'remote') {
            try {
                add(new URL(spritePath, this.configSource.url).href);
            } catch {
                /* ignore */
            }
            if (this.configSource.dirUrl) {
                try {
                    add(new URL(spritePath, this.configSource.dirUrl).href);
                } catch {
                    /* ignore */
                }
                const fileName = spritePath.split('/').pop();
                if (fileName) {
                    try {
                        add(new URL(fileName, this.configSource.dirUrl).href);
                    } catch {
                        /* ignore */
                    }
                }
            }
        }
        if (this.currentConfigDirHint) {
            add(joinPath(this.currentConfigDirHint, spritePath));
            const fileName = spritePath.split('/').pop();
            if (fileName && fileName !== spritePath) {
                add(joinPath(this.currentConfigDirHint, fileName));
            }
        }
        try {
            add(new URL(spritePath, window.location.href).href);
        } catch {
            /* ignore */
        }
        return candidates;
    }

    loadSpriteFromCandidates(candidates, index, originalPath) {
        if (index >= candidates.length) {
            this.spriteImage = null;
            this.drawSprite();
            this.updateSpriteSummary();
            this.setStatus(`Could not load sprite from ${originalPath}`, 'warn');
            return;
        }
        const candidate = candidates[index];
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            this.setSpriteImage(image, { type: 'path', url: candidate, originalPath });
            if (!this.config.sprite.size_px.w) {
                setValueAtPath(this.config, 'sprite.size_px.w', image.naturalWidth);
                this.updateInputDisplay('sprite.size_px.w');
            }
            if (!this.config.sprite.size_px.h) {
                setValueAtPath(this.config, 'sprite.size_px.h', image.naturalHeight);
                this.updateInputDisplay('sprite.size_px.h');
            }
            this.refreshOutputs();
        };
        image.onerror = () => {
            this.loadSpriteFromCandidates(candidates, index + 1, originalPath);
        };
        image.src = candidate;
    }

    drawSprite() {
        const canvas = this.elements.spriteCanvas;
        const ctx = canvas.getContext('2d');
        const scale = Number(this.elements.previewScale.value || 1);
        if (!this.spriteImage) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#0a0d19';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.font = '14px "Segoe UI"';
            ctx.textAlign = 'center';
            ctx.fillText('Sprite preview unavailable', canvas.width / 2, canvas.height / 2);
            return;
        }
        const width = this.spriteImage.naturalWidth;
        const height = this.spriteImage.naturalHeight;
        canvas.width = Math.max(width * scale, 32);
        canvas.height = Math.max(height * scale, 32);

        ctx.save();
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.scale(scale, scale);
        ctx.drawImage(this.spriteImage, 0, 0);
        ctx.restore();

        const pivotX = Number(this.config.sprite.pivot_px.x ?? width / 2);
        const pivotY = Number(this.config.sprite.pivot_px.y ?? height / 2);
        ctx.save();
        ctx.translate(pivotX * scale, pivotY * scale);
        ctx.strokeStyle = '#ff5f74';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
    }

    handleSpriteClick(event) {
        if (!this.spriteImage) {
            return;
        }
        const rect = this.elements.spriteCanvas.getBoundingClientRect();
        const scale = Number(this.elements.previewScale.value || 1);
        const x = (event.clientX - rect.left) / scale;
        const y = (event.clientY - rect.top) / scale;
        setValueAtPath(this.config, 'sprite.pivot_px.x', round(x, 2));
        setValueAtPath(this.config, 'sprite.pivot_px.y', round(y, 2));
        this.updateInputDisplay('sprite.pivot_px.x');
        this.updateInputDisplay('sprite.pivot_px.y');
        this.drawSprite();
        this.refreshOutputs();
    }

    updateSpriteSummary() {
        const sprite = this.config.sprite;
        if (!sprite) {
            if (this.elements.spriteSummaryContent) {
                this.elements.spriteSummaryContent.textContent = 'Sprite not loaded';
            }
            return;
        }
        const { w, h } = sprite.size_px;
        const pivot = sprite.pivot_px || { x: 0, y: 0 };
        const info = [
            sprite.path ? `Path: ${sprite.path}` : 'Path not set',
            `Size: ${w || '?'}x${h || '?'} px`,
            `Pivot: ${pivot.x ?? '?'} / ${pivot.y ?? '?'} px`,
            `Meters per px: ${sprite.m_per_px || '?'}`
        ];
        if (this.spriteSource?.type === 'file' && this.spriteSource?.name) {
            info.push(`Source: file ${this.spriteSource.name}`);
        }
        if (this.elements.spriteSummaryContent) {
            this.elements.spriteSummaryContent.innerHTML = info.join('<br>');
        }
    }

    copyJson() {
        const text = this.elements.jsonPreview.value;
        if (!navigator.clipboard) {
            this.setStatus('Clipboard API is unavailable', 'warn');
            return;
        }
        navigator.clipboard.writeText(text)
            .then(() => this.setStatus('JSON copied to clipboard'))
            .catch((error) => {
                console.error(error);
                this.setStatus('Failed to copy JSON', 'error');
            });
    }

    applyFieldAction(handler, path, type) {
        if (typeof handler !== 'function') {
            return;
        }
        const outcome = handler(this, path);
        if (!outcome) {
            this.setStatus('No data available for this action', 'warn');
            return;
        }
        if (outcome.error) {
            this.setStatus(outcome.error, 'warn');
            return;
        }
        if (outcome.patch) {
            this.applyPatch(outcome.patch);
        }
        if (outcome.message) {
            const statusType = outcome.type || (type === 'recommend' ? 'info' : 'info');
            this.setStatus(outcome.message, statusType);
        }
    }

    applyPatch(patch) {
        let spriteRequiresRefresh = false;
        let inertiaUpdated = false;
        Object.entries(patch).forEach(([path, value]) => {
            setValueAtPath(this.config, path, value);
            this.updateInputDisplay(path);
            if (path.startsWith('sprite.')) {
                spriteRequiresRefresh = true;
            }
            if (path.startsWith('mass.inertia_override')) {
                inertiaUpdated = true;
            }
        });
        if (spriteRequiresRefresh) {
            const needsForce = Object.prototype.hasOwnProperty.call(patch, 'sprite.path');
            this.updateSpriteFromConfig(needsForce, needsForce ? 'sprite.path' : '');
            this.drawSprite();
        }
        if (inertiaUpdated) {
            this.updateInertiaToggle();
        }
        this.refreshOutputs();
    }

    inferPreferredSpritePath(filename, previousPath) {
        if (!filename) {
            return previousPath || '';
        }
        const safeName = filename.replace(/\\/g, '/').split('/').pop();
        if (previousPath && previousPath.includes('/')) {
            const index = previousPath.lastIndexOf('/');
            return `${previousPath.slice(0, index + 1)}${safeName}`;
        }
        if (this.currentConfigDirHint) {
            return joinPath(this.currentConfigDirHint, safeName);
        }
        const shipClass = (this.config.meta.class || 'ship').replace(/\s+/g, '_');
        return `ships/${shipClass}/${safeName}`;
    }

    setRemoteConfigSource(path) {
        const normalized = (path || '').replace(/\\/g, '/');
        this.currentConfigPath = normalized;
        this.currentConfigDirHint = null;
        if (normalized.includes('/')) {
            const index = normalized.lastIndexOf('/');
            this.currentConfigDirHint = normalized.slice(0, index + 1);
        }
        try {
            const url = new URL(normalized, window.location.href);
            this.configSource = {
                type: 'remote',
                url,
                dirUrl: new URL('./', url).href
            };
        } catch {
            this.configSource = null;
        }
    }

    setHandleConfigSource(handle) {
        this.fileHandle = handle;
        this.currentConfigPath = handle?.name || null;
        this.currentConfigDirHint = null;
        this.configSource = handle ? { type: 'handle', handle, name: handle.name } : null;
    }

    setLooseConfigSource(fileName) {
        this.currentConfigPath = fileName || null;
        this.currentConfigDirHint = null;
        this.configSource = { type: 'local', name: fileName || null };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ShipConfigEditor();
});
