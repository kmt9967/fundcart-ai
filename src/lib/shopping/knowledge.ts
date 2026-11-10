// Use-case requirement knowledge base.
//
// Each profile turns a *need* ("learn Android Studio", "edit 4K video") into product requirements at
// three levels:
//   minimum      – a product below this is not suitable (filters results)
//   recommended  – the best-value level (drives ranking and the "Recommended" label)
//   premium      – optional upgrades that most people with this need do not require
// Requirements carry their origin and source so the UI can say where each one comes from.
// Nothing here is specific to one product or one query: profiles are matched from the structured
// intent (software, use cases, category) and from multilingual keywords.

import type { Requirement } from './types';

export type Profile = {
  id: string;
  label: string; // shown to users, e.g. "Android Studio with the emulator"
  categories: string[]; // canonical categories this profile applies to (first = default)
  /** Lower-case keywords matched against the canonical intent fields and the raw message. */
  keywords: RegExp;
  requirements: Requirement[];
  /** Targeted Channel3 queries (max 2 used per turn). */
  queries: string[];
  sources: Array<{ title: string; url: string }>;
  /** A related variant the user can switch to (e.g. testing on a phone instead of the emulator). */
  variant?: { profileId: string; trigger: RegExp; note: string };
  note?: string;
};

const AS = { title: 'Android Studio system requirements (developer.android.com)', url: 'https://developer.android.com/studio/install' };

export const PROFILES: Profile[] = [
  {
    id: 'android_studio',
    label: 'Android Studio with the Android Emulator',
    categories: ['laptop', 'desktop'],
    keywords: /android\s*studio|android (app )?develop|android apps?|kotlin|flutter|jetpack compose|اینڈرائیڈ|androide|développement android/i,
    requirements: [
      { field: 'ram_gb', op: '>=', value: 16, level: 'minimum', origin: 'official', why: 'Official minimum for Android Studio together with the Emulator is 16 GB RAM (8 GB for Studio alone).', source: AS },
      { field: 'cpu_modern', op: '==', value: true, level: 'minimum', origin: 'official', why: 'Official minimum: a CPU microarchitecture from after 2017 (Intel 8th Gen Core or newer, AMD Ryzen) or Apple Silicon.', source: AS },
      { field: 'arm', op: '==', value: false, level: 'minimum', origin: 'official', why: 'Windows and Linux machines with ARM processors are not supported by Android Studio.', when: { osNot: ['macos'] }, source: AS },
      { field: 'os', op: 'in', value: ['windows', 'macos', 'linux'], level: 'minimum', origin: 'official', why: 'Needs 64-bit Windows, macOS or Linux. On ChromeOS, Android Studio can only deploy to a connected phone, not the emulator.', source: AS },
      { field: 'gpu_vram_gb', op: '>=', value: 4, level: 'minimum', origin: 'official', why: 'Official minimum for Studio & Emulator on Windows/Linux: a GPU with 4 GB VRAM (e.g. GeForce 10 series or newer). Macs use integrated graphics.', when: { osNot: ['macos'] }, source: AS },
      { field: 'storage_gb', op: '>=', value: 256, level: 'minimum', origin: 'derived', why: 'The OS, Android Studio, the SDK and emulator images together need well over the 16 GB of free space Google lists; 256 GB leaves room to work.' },
      { field: 'storage_type', op: '==', value: 'ssd', level: 'recommended', origin: 'official', why: 'Google recommends a solid state drive.', source: AS },
      { field: 'cpu_tier', op: '>=', value: 5, level: 'recommended', origin: 'official', why: 'Google recommends H/HX-series laptop CPUs (or recent Apple Silicon); Intel N- and U-series are "not recommended due to insufficient performance".', source: AS },
      { field: 'storage_gb', op: '>=', value: 512, level: 'recommended', origin: 'derived', why: 'Several emulator images and projects fill 256 GB quickly.' },
      { field: 'arm', op: '==', value: true, level: 'recommended', origin: 'official', why: 'On a Mac, Google recommends Apple Silicon and says it is phasing out support for Macs with Intel chips.', when: { osIn: ['macos'] }, source: AS },
      { field: 'ram_gb', op: '>=', value: 32, level: 'premium', origin: 'official', why: 'Google\'s recommended (not minimum) RAM. Helpful for large projects; a beginner does not need it.', source: AS },
      { field: 'gpu_vram_gb', op: '>=', value: 8, level: 'premium', origin: 'official', why: 'Google\'s recommended GPU tier. Not needed to learn Android development.', when: { osNot: ['macos'] }, source: AS },
    ],
    queries: ['laptop 16GB RAM Intel Core i5 H RTX 3050 SSD', 'MacBook Air M2 16GB'],
    sources: [AS],
    variant: { profileId: 'android_studio_device', trigger: /(own|my|real|physical) (android )?(phone|device)|without (the )?emulator|no emulator|usb debugging/i, note: 'The Emulator is what drives the 16 GB RAM and 4 GB graphics requirement. If you have a modern Android phone, testing on it over USB (or with Android Device Streaming) lowers the official minimum to 8 GB RAM with no dedicated graphics card, which is a much cheaper laptop.' },
  },
  {
    id: 'android_studio_device',
    label: 'Android Studio, testing on a physical Android phone (no emulator)',
    categories: ['laptop', 'desktop'],
    keywords: /^$/, // only reached through the android_studio profile when the testing method is a phone or not yet known
    requirements: [
      { field: 'ram_gb', op: '>=', value: 8, level: 'minimum', origin: 'official', why: 'Official minimum for Android Studio alone (without the Emulator) is 8 GB RAM.', source: AS },
      { field: 'cpu_modern', op: '==', value: true, level: 'minimum', origin: 'official', why: 'Official minimum for Android Studio alone: a CPU microarchitecture from after 2017 with virtualization (Intel 8th Gen Core / AMD Ryzen), or Apple Silicon.', source: AS },
      { field: 'arm', op: '==', value: false, level: 'minimum', origin: 'official', why: 'ARM-based Windows and Linux machines are not supported.', when: { osNot: ['macos'] }, source: AS },
      { field: 'os', op: 'in', value: ['windows', 'macos', 'linux', 'chromeos'], level: 'minimum', origin: 'official', why: 'Windows, macOS or Linux. Android Studio on ChromeOS can deploy only to a connected phone, which suits this workflow.', source: AS },
      { field: 'storage_gb', op: '>=', value: 128, level: 'minimum', origin: 'derived', why: 'Google lists 8 GB of free space for Android Studio alone; 128 GB leaves room for the OS, the SDK and projects.' },
      { field: 'storage_type', op: '==', value: 'ssd', level: 'recommended', origin: 'official', why: 'Google recommends a solid state drive.', source: AS },
      { field: 'cpu_tier', op: '>=', value: 5, level: 'recommended', origin: 'official', why: 'Google says Intel N- and U-series processors are "not recommended due to insufficient performance".', source: AS },
      { field: 'ram_gb', op: '>=', value: 16, level: 'recommended', origin: 'official', why: '16 GB is the official minimum if you later add the Emulator, so it keeps that option open.', source: AS },
      { field: 'storage_gb', op: '>=', value: 256, level: 'recommended', origin: 'derived', why: 'Room for several projects and SDK versions.' },
    ],
    queries: ['laptop 8GB RAM Intel Core i5 SSD', 'laptop 16GB RAM Ryzen 5 SSD'],
    sources: [AS],
    variant: { profileId: 'android_studio', trigger: /emulator/i, note: 'You need no dedicated graphics card for this. A modern Android phone with USB debugging (or the Android Device Streaming service) is enough to run your apps. If you will use the Android Emulator instead, the official minimum rises to 16 GB RAM and, on Windows or Linux, a GPU with 4 GB VRAM. Any Apple Silicon Mac with 16 GB RAM meets both.' },
  },
  {
    id: 'ios_dev',
    label: 'iOS / Xcode development',
    categories: ['laptop', 'desktop'],
    keywords: /\bxcode\b|\bswift ?ui\b|\bios (app )?develop|iphone apps?/i,
    requirements: [
      { field: 'os', op: '==', value: 'macos', level: 'minimum', origin: 'official', why: 'Xcode only runs on macOS.', source: { title: 'Xcode (developer.apple.com)', url: 'https://developer.apple.com/xcode/' } },
      { field: 'cpu_modern', op: '==', value: true, level: 'minimum', origin: 'derived', why: 'Current Xcode releases target recent macOS versions; Apple Silicon Macs are the safe choice.' },
      { field: 'storage_gb', op: '>=', value: 256, level: 'minimum', origin: 'derived', why: 'Xcode and simulators need tens of GB.' },
      { field: 'ram_gb', op: '>=', value: 16, level: 'recommended', origin: 'derived', why: 'Simulators run much more smoothly with 16 GB.' },
      { field: 'storage_gb', op: '>=', value: 512, level: 'recommended', origin: 'derived', why: 'Several simulator runtimes fill 256 GB quickly.' },
    ],
    queries: ['MacBook Air M2 16GB', 'MacBook Air M3'],
    sources: [{ title: 'Xcode (developer.apple.com)', url: 'https://developer.apple.com/xcode/' }],
  },
  {
    id: 'video_editing',
    label: 'Video editing',
    categories: ['laptop', 'desktop'],
    keywords: /video edit|editing videos?|premiere|davinci|final cut|4k (footage|video)|edición de video|montage vidéo|ویڈیو ایڈیٹنگ/i,
    requirements: [
      { field: 'ram_gb', op: '>=', value: 16, level: 'minimum', origin: 'derived', why: 'Editors like Premiere Pro and DaVinci Resolve list 16 GB as the practical minimum for HD/4K work.' },
      { field: 'cpu_tier', op: '>=', value: 4, level: 'minimum', origin: 'derived', why: 'Timeline playback and exports need a current mid-range CPU or better.' },
      { field: 'storage_type', op: '==', value: 'ssd', level: 'minimum', origin: 'derived', why: 'Footage must load from fast storage.' },
      { field: 'storage_gb', op: '>=', value: 512, level: 'minimum', origin: 'derived', why: 'Video projects are large.' },
      { field: 'gpu_vram_gb', op: '>=', value: 6, level: 'recommended', origin: 'derived', why: 'GPU acceleration speeds up effects and 4K exports.', when: { osNot: ['macos'] } },
      { field: 'ram_gb', op: '>=', value: 32, level: 'premium', origin: 'derived', why: 'Helps with heavy 4K/8K multicam work.' },
    ],
    queries: ['laptop video editing 16GB RAM RTX 4050', 'MacBook Pro M3 16GB'],
    sources: [],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    categories: ['laptop', 'desktop', 'monitor'],
    keywords: /\bgaming\b|\bgamer\b|play games|video games|\bfortnite\b|\bvalorant\b|\bgta\b/i,
    requirements: [
      { field: 'gpu_dedicated', op: '==', value: true, level: 'minimum', origin: 'derived', why: 'Modern games need a dedicated graphics card.' },
      { field: 'gpu_vram_gb', op: '>=', value: 4, level: 'minimum', origin: 'derived', why: 'Below 4 GB VRAM most current games will not run at playable settings.' },
      { field: 'ram_gb', op: '>=', value: 16, level: 'recommended', origin: 'derived', why: '16 GB is the current sweet spot for games.' },
      { field: 'gpu_vram_gb', op: '>=', value: 8, level: 'recommended', origin: 'derived', why: '8 GB VRAM handles new releases at high settings.' },
      { field: 'refresh_hz', op: '>=', value: 144, level: 'recommended', origin: 'derived', why: 'A 144 Hz screen makes fast games smoother.' },
    ],
    queries: ['gaming laptop RTX 4060 16GB'],
    sources: [],
  },
  {
    id: 'ml',
    label: 'Machine learning / AI development',
    categories: ['laptop', 'desktop'],
    keywords: /machine learning|deep learning|\bml\b|pytorch|tensorflow|train(ing)? models?|stable diffusion|local llm/i,
    requirements: [
      { field: 'ram_gb', op: '>=', value: 16, level: 'minimum', origin: 'derived', why: 'Datasets and frameworks need at least 16 GB.' },
      { field: 'cpu_modern', op: '==', value: true, level: 'minimum', origin: 'derived', why: 'Current frameworks need a recent CPU.' },
      { field: 'gpu_vram_gb', op: '>=', value: 8, level: 'recommended', origin: 'derived', why: 'Training on a GPU needs 8 GB+ VRAM (NVIDIA CUDA is the most widely supported).', when: { osNot: ['macos'] } },
      { field: 'ram_gb', op: '>=', value: 32, level: 'recommended', origin: 'derived', why: 'Larger models and datasets.' },
    ],
    queries: ['laptop RTX 4060 32GB RAM', 'MacBook Pro M3 Pro'],
    sources: [],
  },
  {
    id: 'programming',
    label: 'Programming / computer science study',
    categories: ['laptop', 'desktop'],
    keywords: /programming|coding|\bcode\b|software (engineering|development)|computer science|\bcs (degree|student|major)\b|web develop|python|java\b|visual studio|vs ?code|پروگرامنگ|programación|programmation/i,
    requirements: [
      { field: 'ram_gb', op: '>=', value: 8, level: 'minimum', origin: 'derived', why: 'An IDE, a browser and a local server together need at least 8 GB.' },
      { field: 'cpu_modern', op: '==', value: true, level: 'minimum', origin: 'derived', why: 'Compilers and IDEs are slow on pre-2017 and N-series processors.' },
      { field: 'storage_type', op: '==', value: 'ssd', level: 'minimum', origin: 'derived', why: 'An SSD keeps builds and the IDE responsive.' },
      { field: 'ram_gb', op: '>=', value: 16, level: 'recommended', origin: 'derived', why: '16 GB handles Docker, emulators and larger projects later in a degree.' },
      { field: 'storage_gb', op: '>=', value: 512, level: 'recommended', origin: 'derived', why: 'Room for tools, SDKs and projects.' },
      { field: 'ram_gb', op: '>=', value: 32, level: 'premium', origin: 'derived', why: 'Only needed for heavy virtualization or large builds.' },
    ],
    queries: ['laptop 16GB RAM SSD Intel Core i5', 'laptop 16GB RAM Ryzen 5 512GB SSD'],
    sources: [],
  },
  {
    id: 'student_general',
    label: 'Study, office work and browsing',
    categories: ['laptop', 'desktop', 'tablet'],
    keywords: /universit|college|school|student|study|studies|office work|homework|assignments|online classes|بچوں|پڑھائی|estudiante|étudiant/i,
    requirements: [
      { field: 'ram_gb', op: '>=', value: 8, level: 'minimum', origin: 'derived', why: '8 GB keeps a browser with many tabs, documents and video calls smooth.' },
      { field: 'storage_type', op: 'in', value: ['ssd', 'emmc'], level: 'minimum', origin: 'derived', why: 'Flash storage (SSD or eMMC) instead of a slow hard drive.' },
      { field: 'cpu_tier', op: '>=', value: 3, level: 'recommended', origin: 'derived', why: 'An i3/Ryzen 3 or better stays responsive for years; entry N-series chips feel slow.' },
      { field: 'storage_gb', op: '>=', value: 256, level: 'recommended', origin: 'derived', why: 'Room for files and apps.' },
      { field: 'ram_gb', op: '>=', value: 32, level: 'premium', origin: 'derived', why: 'Far more than study and office work need.' },
    ],
    queries: ['laptop for students 8GB RAM SSD'],
    sources: [],
  },
  {
    id: 'anc_headphones',
    label: 'Noise-cancelling headphones',
    categories: ['headphones'],
    keywords: /noise[- ]cancel|\banc\b|commut|flight|travel|quiet|شور/i,
    requirements: [
      { field: 'anc', op: '==', value: true, level: 'minimum', origin: 'derived', why: 'Active noise cancellation is what blocks engine and traffic noise.' },
      { field: 'wireless', op: '==', value: true, level: 'recommended', origin: 'derived', why: 'Wireless is easier on a commute.' },
    ],
    queries: ['active noise cancelling headphones'],
    sources: [],
  },
  {
    id: 'beginner_camera',
    label: 'Learning photography',
    categories: ['camera'],
    keywords: /dslr|mirrorless|photography (class|course)|learn photography|first camera|beginner camera/i,
    requirements: [
      { field: 'interchangeable_lens', op: '==', value: true, level: 'minimum', origin: 'derived', why: 'Photography classes expect a camera with interchangeable lenses and manual controls.' },
    ],
    queries: ['beginner mirrorless camera kit lens'],
    sources: [],
  },
];

export function profileById(id: string): Profile | undefined { return PROFILES.find(p => p.id === id); }

/**
 * Choose the most specific profile for an intent. Specific software/use cases win over general study.
 * Returns null when nothing applies (the explicit constraints still apply).
 */
export function matchProfile(category: string | null, haystack: string): Profile | null {
  const order = ['android_studio', 'ios_dev', 'ml', 'video_editing', 'gaming', 'programming', 'student_general', 'anc_headphones', 'beginner_camera'];
  for (const id of order) {
    const p = profileById(id)!;
    if (!p.keywords.test(haystack)) continue;
    if (category && !p.categories.includes(category)) {
      // Software named without a device ("I want Android Studio") still implies a computer.
      if (['android_studio', 'ios_dev', 'ml', 'programming', 'video_editing'].includes(id) && (category === 'software' || category === 'unknown')) return p;
      continue;
    }
    return p;
  }
  return null;
}

/** Canonical category → Channel3 category slugs (validated against live responses) and product kinds. */
export const CATEGORY_MAP: Record<string, { slugs: string[]; kinds: string[]; noun: string }> = {
  laptop: { slugs: ['laptops', 'gaming-laptops'], kinds: ['laptop'], noun: 'laptop' },
  desktop: { slugs: ['desktop-computers', 'gaming-desktops', 'all-in-one-computers'], kinds: ['desktop'], noun: 'desktop computer' },
  tablet: { slugs: ['tablet-computers'], kinds: ['tablet'], noun: 'tablet' },
  headphones: { slugs: ['headphones'], kinds: ['headphones'], noun: 'headphones' },
  phone: { slugs: [], kinds: ['phone'], noun: 'phone' },
  monitor: { slugs: [], kinds: ['monitor'], noun: 'monitor' },
  camera: { slugs: [], kinds: ['camera'], noun: 'camera' },
};

/** Categories where a software title, book or accessory in the results is a wrong-category match. */
export const DEVICE_CATEGORIES = new Set(['laptop', 'desktop', 'tablet', 'headphones', 'phone', 'monitor', 'camera']);
