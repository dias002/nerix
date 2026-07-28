import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  CircleStop,
  Download,
  Film,
  ImageUp,
  Loader2,
  Mic,
  Palette,
  Play,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import {
  FaceLandmarker,
  FilesetResolver,
  type Category,
  type FaceLandmarkerResult,
  type Matrix,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three/src/constants.js";
import { PerspectiveCamera } from "three/src/cameras/PerspectiveCamera.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { BoxGeometry } from "three/src/geometries/BoxGeometry.js";
import { CapsuleGeometry } from "three/src/geometries/CapsuleGeometry.js";
import { CircleGeometry } from "three/src/geometries/CircleGeometry.js";
import { CylinderGeometry } from "three/src/geometries/CylinderGeometry.js";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { ShapeGeometry } from "three/src/geometries/ShapeGeometry.js";
import { SphereGeometry } from "three/src/geometries/SphereGeometry.js";
import { TorusGeometry } from "three/src/geometries/TorusGeometry.js";
import { TubeGeometry } from "three/src/geometries/TubeGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { MeshPhysicalMaterial } from "three/src/materials/MeshPhysicalMaterial.js";
import { MeshStandardMaterial } from "three/src/materials/MeshStandardMaterial.js";
import { Material } from "three/src/materials/Material.js";
import { Color } from "three/src/math/Color.js";
import { Euler } from "three/src/math/Euler.js";
import { Matrix4 } from "three/src/math/Matrix4.js";
import { Vector3 } from "three/src/math/Vector3.js";
import { Object3D } from "three/src/core/Object3D.js";
import { Shape } from "three/src/extras/core/Shape.js";
import { CatmullRomCurve3 } from "three/src/extras/curves/CatmullRomCurve3.js";
import { DirectionalLight } from "three/src/lights/DirectionalLight.js";
import { HemisphereLight } from "three/src/lights/HemisphereLight.js";
import { PointLight } from "three/src/lights/PointLight.js";
import { Scene } from "three/src/scenes/Scene.js";
import { FogExp2 } from "three/src/scenes/FogExp2.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";
import { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import type { MediaGenerationJobApiRecord } from "../api-client";
import {
  cancelGenerationJob,
  createGenerationJob,
  fetchGenerationArtifact,
  refreshGenerationJob,
} from "../api-client/generation";
import { useAuth } from "../auth";
import { toPublicApiError } from "../api-client/transport";
import OptimizedImage from "../components/OptimizedImage";

type HairStyle = "short" | "soft" | "bun" | "none";
type MeetingBackground = "studio" | "office" | "dark";
type FaceShape = "oval" | "round" | "angular" | "long";
type BrowStyle = "soft" | "straight" | "arched" | "thick";
type EyeStyle = "calm" | "open" | "focused";
type GlassesStyle = "none" | "round" | "square" | "thin";
type FacialHairStyle = "none" | "mustache" | "beard";
type AvatarReferenceId =
  | "soft-3d"
  | "anime"
  | "pixel"
  | "clay"
  | "editorial"
  | "cinematic";
type AvatarExpressionId = "neutral" | "smile" | "thinking" | "wave" | "wink" | "talking";

type AvatarConfig = {
  skin: string;
  hair: string;
  outfit: string;
  accent: string;
  hairStyle: HairStyle;
  background: MeetingBackground;
  headSensitivity: number;
  voiceSensitivity: number;
  photoDataUrl: string | null;
  sculpt: AvatarSculpt;
  faceShape: FaceShape;
  browStyle: BrowStyle;
  eyeStyle: EyeStyle;
  glassesStyle: GlassesStyle;
  facialHairStyle: FacialHairStyle;
};

type AvatarSculpt = {
  faceWidth: number;
  faceLength: number;
  jawWidth: number;
  eyeSpacing: number;
  eyeSize: number;
  browLift: number;
  noseWidth: number;
  noseLength: number;
  mouthWidth: number;
  hasGlasses: boolean;
};

type AvatarReferencePreset = {
  id: AvatarReferenceId;
  title: string;
  imageSrc: string;
  promptNotes: string;
  configPatch: Partial<AvatarConfig>;
};

type AvatarExpressionPreset = {
  id: AvatarExpressionId;
  title: string;
  prompt: string;
};

type AvatarExpressionRender = {
  expressionId: AvatarExpressionId;
  job?: MediaGenerationJobApiRecord;
  imageUrl?: string;
  error?: string;
  busy?: boolean;
};

type TrackingState = {
  yaw: number;
  pitch: number;
  roll: number;
  mouth: number;
  energy: number;
  blinkLeft: number;
  blinkRight: number;
  brow: number;
  smile: number;
};

type TrackingBackend = "fallback" | "mediapipe";

type PremiumAvatarTextureState = {
  image: HTMLImageElement | null;
  photoImage: HTMLImageElement | null;
  photoSource: string | null;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: CanvasTexture;
};

type AvatarSceneHandles = {
  root: Group;
  premiumAvatar: Group;
  head: Group;
  face: Mesh;
  jaw: Mesh;
  nose: Mesh;
  noseBridge: Mesh;
  mouth: Mesh;
  leftEye: Group;
  rightEye: Group;
  leftLid: Mesh;
  rightLid: Mesh;
  leftBrow: Mesh;
  rightBrow: Mesh;
  facialHair: Group;
  mustache: Group;
  beard: Group;
  glasses: Group;
  glassesRound: Group;
  glassesSquare: Group;
  glassesThin: Group;
  leftCheek: Mesh;
  rightCheek: Mesh;
  body: Group;
  materials: {
    skin: MeshStandardMaterial;
    shadowSkin: MeshStandardMaterial;
    hair: MeshStandardMaterial;
    outfit: MeshStandardMaterial;
    accent: MeshStandardMaterial;
  };
  hairParts: Object3D[];
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  premiumTextureState: PremiumAvatarTextureState | null;
  premiumBaseScale: number;
};

const storageKey = "nomduchat-avatar-studio:v1";

const defaultSculpt: AvatarSculpt = {
  faceWidth: 1,
  faceLength: 1,
  jawWidth: 1,
  eyeSpacing: 1,
  eyeSize: 1,
  browLift: 1,
  noseWidth: 1,
  noseLength: 1,
  mouthWidth: 1,
  hasGlasses: false,
};

const defaultConfig: AvatarConfig = {
  skin: "#D8A27A",
  hair: "#1C1716",
  outfit: "#1E3A5F",
  accent: "#20E3B2",
  hairStyle: "soft",
  background: "studio",
  headSensitivity: 0.72,
  voiceSensitivity: 0.82,
  photoDataUrl: null,
  sculpt: defaultSculpt,
  faceShape: "oval",
  browStyle: "soft",
  eyeStyle: "calm",
  glassesStyle: "none",
  facialHairStyle: "none",
};

const skinSwatches = ["#F0C7A8", "#D8A27A", "#B87552", "#7A4A35", "#F3D7BF"];
const hairSwatches = ["#111111", "#4B2E21", "#C07A3D", "#B6B6B6", "#7C3AED"];
const outfitSwatches = ["#1E3A5F", "#123B35", "#3B1F47", "#4A1D1F", "#F6F7F9"];
const accentSwatches = ["#20E3B2", "#7C3AED", "#F59E0B", "#38BDF8", "#F43F5E"];

const avatarReferencePresets: AvatarReferencePreset[] = [
  {
    id: "soft-3d",
    title: "Мягкий 3D",
    imageSrc: "/avatar/references/style-soft-3d.jpg",
    promptNotes: "premium soft 3D character portrait, rounded forms, sculpted hair, expressive eyes, polished studio materials",
    configPatch: {
      skin: "#D8A27A",
      hair: "#4B2E21",
      outfit: "#111111",
      accent: "#FF7664",
      hairStyle: "soft",
      faceShape: "round",
      browStyle: "soft",
      eyeStyle: "open",
      glassesStyle: "round",
      facialHairStyle: "none",
    },
  },
  {
    id: "anime",
    title: "Аниме",
    imageSrc: "/avatar/references/style-anime.jpg",
    promptNotes: "refined contemporary anime portrait, elegant clean linework, sophisticated cel shading, expressive natural eyes",
    configPatch: {
      skin: "#F0C7A8",
      hair: "#22172F",
      outfit: "#171126",
      accent: "#A78BFA",
      hairStyle: "soft",
      faceShape: "oval",
      browStyle: "arched",
      eyeStyle: "open",
      glassesStyle: "none",
      facialHairStyle: "none",
    },
  },
  {
    id: "pixel",
    title: "Пиксельный",
    imageSrc: "/avatar/references/style-pixel.jpg",
    promptNotes: "refined modern pixel art portrait, deliberate crisp pixels, premium game profile quality, expressive face",
    configPatch: {
      skin: "#D8A27A",
      hair: "#2E1829",
      outfit: "#161127",
      accent: "#FF7664",
      hairStyle: "short",
      faceShape: "angular",
      browStyle: "straight",
      eyeStyle: "focused",
      glassesStyle: "none",
      facialHairStyle: "none",
    },
  },
  {
    id: "clay",
    title: "Clay",
    imageSrc: "/avatar/references/style-clay.jpg",
    promptNotes: "tactile premium polymer clay character portrait, subtle handmade texture, stop motion studio quality",
    configPatch: {
      skin: "#F0C7A8",
      hair: "#6A3A27",
      outfit: "#2A1B38",
      accent: "#F59E0B",
      hairStyle: "bun",
      faceShape: "oval",
      browStyle: "soft",
      eyeStyle: "calm",
      glassesStyle: "none",
      facialHairStyle: "none",
    },
  },
  {
    id: "editorial",
    title: "Иллюстрация",
    imageSrc: "/avatar/references/style-editorial.jpg",
    promptNotes: "bold premium editorial portrait, geometric shapes, subtle grain, sophisticated magazine illustration",
    configPatch: {
      skin: "#D8A27A",
      hair: "#311C2C",
      outfit: "#121526",
      accent: "#73E6C2",
      hairStyle: "short",
      faceShape: "oval",
      browStyle: "thick",
      eyeStyle: "calm",
      glassesStyle: "none",
      facialHairStyle: "none",
    },
  },
  {
    id: "cinematic",
    title: "Cinematic",
    imageSrc: "/avatar/references/style-cinematic.jpg",
    promptNotes: "cinematic semi-realistic digital portrait, realistic proportions with tasteful stylization, premium creator profile quality",
    configPatch: {
      skin: "#F0C7A8",
      hair: "#3A221D",
      outfit: "#111523",
      accent: "#FF7664",
      hairStyle: "soft",
      faceShape: "oval",
      browStyle: "soft",
      eyeStyle: "focused",
      glassesStyle: "none",
      facialHairStyle: "none",
    },
  },
];

const avatarExpressionPresets: AvatarExpressionPreset[] = [
  { id: "neutral", title: "Профиль", prompt: "neutral friendly expression, facing camera, clean profile avatar crop" },
  { id: "smile", title: "Улыбка", prompt: "warm smile, friendly eye contact, relaxed shoulders" },
  { id: "thinking", title: "Думает", prompt: "thoughtful expression, hand near chin, focused eyes" },
  { id: "wave", title: "Привет", prompt: "waving hand, welcoming smile, energetic but clean composition" },
  { id: "wink", title: "Подмигивает", prompt: "one eye wink, playful smile, same outfit and character identity" },
  { id: "talking", title: "Говорит", prompt: "speaking mouth pose, natural presenter expression, ready for light talking animation" },
];

const defaultExpressionIds: AvatarExpressionId[] = ["neutral", "smile", "thinking", "wave", "wink", "talking"];

const backgroundStyles: Record<MeetingBackground, string> = {
  studio: "radial-gradient(circle at 50% 20%, #22313f 0%, #07090b 46%, #000 100%)",
  office: "linear-gradient(135deg, #152016 0%, #0e1214 48%, #070707 100%)",
  dark: "radial-gradient(circle at 52% 42%, #1a1424 0%, #09090b 42%, #000 100%)",
};

const backgroundLabels: Record<MeetingBackground, string> = {
  studio: "Студия",
  office: "Офис",
  dark: "Темный",
};

const hairStyleLabels: Record<HairStyle, string> = {
  short: "Коротко",
  soft: "Объем",
  bun: "Пучок",
  none: "Без волос",
};

const faceShapeLabels: Record<FaceShape, string> = {
  oval: "Овал",
  round: "Круг",
  angular: "Скулы",
  long: "Длинное",
};

const browStyleLabels: Record<BrowStyle, string> = {
  soft: "Мягкие",
  straight: "Прямые",
  arched: "Изгиб",
  thick: "Густые",
};

const eyeStyleLabels: Record<EyeStyle, string> = {
  calm: "Спокойные",
  open: "Открытые",
  focused: "Фокус",
};

const glassesStyleLabels: Record<GlassesStyle, string> = {
  none: "Без очков",
  round: "Круглые",
  square: "Квадрат",
  thin: "Тонкие",
};

const facialHairStyleLabels: Record<FacialHairStyle, string> = {
  none: "Без",
  mustache: "Усы",
  beard: "Борода",
};

const mediaPipeVisionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const mediaPipeFaceLandmarkerUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export default function AvatarStudio() {
  const { isAuthenticated, updateProfile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<AvatarSceneHandles | null>(null);
  const mobileStylePaletteRef = useRef<HTMLDivElement>(null);
  const desktopStylePaletteRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const generatedObjectUrlsRef = useRef<Set<string>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const faceLandmarkerPromiseRef = useRef<Promise<FaceLandmarker | null> | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const trackingBackendRef = useRef<TrackingBackend>("fallback");
  const trackingRef = useRef<TrackingState>({
    yaw: 0,
    pitch: 0,
    roll: 0,
    mouth: 0.04,
    energy: 0,
    blinkLeft: 0,
    blinkRight: 0,
    brow: 0,
    smile: 0,
  });
  const [config, setConfig] = useState<AvatarConfig>(() => readStoredConfig());
  const photoAnalysisSourceRef = useRef<string | null>(config.photoDataUrl);
  const configRef = useRef(config);
  const [cameraStatus, setCameraStatus] = useState<"off" | "starting" | "live" | "error">("off");
  const [micStatus, setMicStatus] = useState<"off" | "live" | "blocked">("off");
  const [trackingBackend, setTrackingBackend] = useState<TrackingBackend>("fallback");
  const [statusText, setStatusText] = useState("Загрузите фото, выберите стиль и создайте AI-портрет.");
  const [savedNotice, setSavedNotice] = useState("");
  const [videoScript, setVideoScript] = useState(
    "Здравствуйте! Это мой AI-аватар в nomduchat. Я могу быстро объяснить продукт, записать приветствие или сделать короткое видео для клиента."
  );
  const [videoMotion, setVideoMotion] = useState("спокойно говорит в камеру, мягко кивает, уверенная деловая подача");
  const [faceConsent, setFaceConsent] = useState(false);
  const [avatarBrief, setAvatarBrief] = useState(
    "дружелюбный современный AI-ассистент, аккуратная одежда, выразительные глаза, чистый студийный фон"
  );
  const [renderJob, setRenderJob] = useState<MediaGenerationJobApiRecord | null>(null);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [renderVideoUrl, setRenderVideoUrl] = useState("");
  const [stageMode, setStageMode] = useState<"portrait" | "liveRig">("portrait");
  const isLiveRigEnabled = false;
  const [selectedReferenceId, setSelectedReferenceId] = useState<AvatarReferenceId>("soft-3d");
  const [isStylePaletteOpen, setIsStylePaletteOpen] = useState(false);
  const stylePaletteHoverTimerRef = useRef<number | null>(null);
  const [activePanel, setActivePanel] = useState<"avatar" | "video" | "live">("avatar");
  const [selectedExpressionIds, setSelectedExpressionIds] = useState<AvatarExpressionId[]>(defaultExpressionIds);
  const [activePreview, setActivePreview] = useState<"base" | AvatarExpressionId>("base");
  const [avatarImageJob, setAvatarImageJob] = useState<MediaGenerationJobApiRecord | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState("");
  const [avatarImageBlob, setAvatarImageBlob] = useState<Blob | null>(null);
  const [avatarImageBusy, setAvatarImageBusy] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState("");
  const [expressionRenders, setExpressionRenders] = useState<AvatarExpressionRender[]>([]);
  const [expressionBusy, setExpressionBusy] = useState(false);
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [profileSaveNotice, setProfileSaveNotice] = useState("");

  const activeStatus = useMemo(() => {
    if (cameraStatus === "starting") return "Запускаю камеру";
    if (cameraStatus === "live") {
      const backendLabel = trackingBackend === "mediapipe" ? "MediaPipe" : "fallback";
      return micStatus === "live" ? `Камера, голос и ${backendLabel}` : `Камера и ${backendLabel}`;
    }
    if (cameraStatus === "error") return "Камера недоступна";
    return "Локальный режим";
  }, [cameraStatus, micStatus, trackingBackend]);

  const selectedReference = useMemo(
    () => avatarReferencePresets.find((preset) => preset.id === selectedReferenceId) ?? avatarReferencePresets[0],
    [selectedReferenceId]
  );

  const isInsideStylePalette = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    return (
      (mobileStylePaletteRef.current && mobileStylePaletteRef.current.contains(target)) ||
      (desktopStylePaletteRef.current && desktopStylePaletteRef.current.contains(target))
    );
  };

  const clearStylePaletteHoverTimer = () => {
    if (stylePaletteHoverTimerRef.current !== null) {
      window.clearTimeout(stylePaletteHoverTimerRef.current);
      stylePaletteHoverTimerRef.current = null;
    }
  };

  const openStylePalette = () => {
    clearStylePaletteHoverTimer();
    setIsStylePaletteOpen(true);
  };

  const closeStylePalette = (event?: React.MouseEvent) => {
    if (event && isInsideStylePalette(event.relatedTarget)) {
      return;
    }

    clearStylePaletteHoverTimer();
    stylePaletteHoverTimerRef.current = window.setTimeout(() => setIsStylePaletteOpen(false), 230);
  };

  const toggleStylePalette = () => {
    clearStylePaletteHoverTimer();
    setIsStylePaletteOpen((current) => !current);
  };

  useEffect(() => {
    if (!isStylePaletteOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!event.target) return;
      if (
        (mobileStylePaletteRef.current && mobileStylePaletteRef.current.contains(event.target as Node)) ||
        (desktopStylePaletteRef.current && desktopStylePaletteRef.current.contains(event.target as Node))
      ) {
        return;
      }
      setIsStylePaletteOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsStylePaletteOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isStylePaletteOpen]);

  useEffect(() => {
    return () => clearStylePaletteHoverTimer();
  }, []);

  const activeExpressionRender = useMemo(
    () => activePreview === "base" ? null : expressionRenders.find((item) => item.expressionId === activePreview) ?? null,
    [activePreview, expressionRenders]
  );

  const generatedPreviewUrl =
    activeExpressionRender?.imageUrl || avatarImageUrl || config.photoDataUrl || selectedReference.imageSrc;
  const portraitStateLabel = avatarImageJob
    ? avatarRenderStatusLabel(avatarImageJob.status)
    : config.photoDataUrl
      ? "Фото готово к AI-стилизации"
      : "Загрузите фото";

  useEffect(() => {
    if (!containerRef.current) return;

    const handles = createAvatarScene(containerRef.current, config);
    sceneRef.current = handles;
    const resizeObserver = new ResizeObserver(() => resizeScene(containerRef.current, handles));
    resizeObserver.observe(containerRef.current);

    const animate = () => {
      animateAvatar(handles, trackingRef.current, configRef.current);
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      handles.renderer.dispose();
      handles.scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      handles.premiumTextureState?.texture.dispose();
      containerRef.current?.replaceChildren();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const handles = sceneRef.current;
    if (!handles) return;

    handles.materials.skin.color.set(config.skin);
    handles.materials.shadowSkin.color.set(config.skin);
    handles.materials.shadowSkin.color.offsetHSL(0, -0.04, -0.08);
    handles.materials.hair.color.set(config.hair);
    handles.materials.outfit.color.set(config.outfit);
    handles.materials.accent.color.set(config.accent);
    updatePremiumAvatarTexture(handles.premiumTextureState, config);
    applyAvatarSculpt(handles, config);
    handles.hairParts.forEach((part) => {
      part.visible = isHairPartVisible(part.name, config.hairStyle);
    });
    handles.scene.background = makeSceneBackground(config.background);
  }, [config]);

  useEffect(() => {
    const photoDataUrl = config.photoDataUrl;
    if (!photoDataUrl || photoAnalysisSourceRef.current === photoDataUrl) return;

    photoAnalysisSourceRef.current = photoDataUrl;
    void extractPhotoProfile(photoDataUrl).then((photoProfile) => {
      setConfig((current) => (current.photoDataUrl === photoDataUrl ? { ...current, ...photoProfile } : current));
    });
  }, [config.photoDataUrl]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const backend = sampleCameraFrame(
        videoRef.current,
        trackingRef,
        previousFrameRef,
        config.headSensitivity,
        faceLandmarkerRef.current,
        lastVideoTimeRef
      );
      if (backend && backend !== trackingBackendRef.current) {
        trackingBackendRef.current = backend;
        setTrackingBackend(backend);
      }
    }, 42);

    return () => window.clearInterval(interval);
  }, [config.headSensitivity]);

  useEffect(
    () => () => {
      cleanupLiveSession();
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      faceLandmarkerPromiseRef.current = null;
    },
    []
  );

  useEffect(
    () => () => {
      if (renderVideoUrl) window.URL.revokeObjectURL(renderVideoUrl);
    },
    [renderVideoUrl]
  );

  useEffect(
    () => () => {
      generatedObjectUrlsRef.current.forEach((url) => window.URL.revokeObjectURL(url));
      generatedObjectUrlsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!renderJob || renderJob.status !== "running") return;

    const interval = window.setInterval(() => {
      void refreshAvatarVideoJob(renderJob.id, false);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [renderJob?.id, renderJob?.status]);

  useEffect(() => {
    if (!avatarImageJob || (avatarImageJob.status !== "queued" && avatarImageJob.status !== "running")) return;

    const interval = window.setInterval(() => {
      void refreshAvatarImageJob();
    }, 6000);

    return () => window.clearInterval(interval);
  }, [avatarImageJob?.id, avatarImageJob?.status]);

  const updateConfig = (patch: Partial<AvatarConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setSavedNotice("");
  };

  const rememberObjectUrl = (blob: Blob) => {
    const url = window.URL.createObjectURL(blob);
    generatedObjectUrlsRef.current.add(url);
    return url;
  };

  const clearGeneratedAvatar = () => {
    setAvatarImageJob(null);
    setAvatarImageUrl("");
    setAvatarImageBlob(null);
    setExpressionRenders([]);
    setActivePreview("base");
    setProfileSaveNotice("");
    setAvatarImageError("");
  };

  const selectReferencePreset = (preset: AvatarReferencePreset) => {
    if (preset.id !== selectedReference.id) clearGeneratedAvatar();
    setSelectedReferenceId(preset.id);
    updateConfig(preset.configPatch);
    setProfileSaveNotice("");
    setStatusText(`Выбран стиль: ${preset.title}.`);
  };

  const toggleExpressionId = (expressionId: AvatarExpressionId) => {
    setSelectedExpressionIds((current) => {
      if (current.includes(expressionId)) {
        return current.length > 1 ? current.filter((id) => id !== expressionId) : current;
      }
      return [...current, expressionId];
    });
  };

  const startAvatarImageRender = async () => {
    const usesUserPhoto = Boolean(config.photoDataUrl);
    if (!usesUserPhoto) {
      setAvatarImageError("Сначала загрузите портретное фото.");
      return;
    }
    if (usesUserPhoto && !faceConsent) {
      setAvatarImageError("Подтвердите разрешение на использование фото для AI-аватара.");
      return;
    }

    setAvatarImageBusy(true);
    setAvatarImageError("");
    setProfileSaveNotice("");
    setActivePreview("base");
    setStatusText("Готовлю AI-портрет в стиле выбранного референса.");

    try {
      const styleReference = {
        ...(await imageUrlToReferenceImage(selectedReference.imageSrc, `${selectedReference.id}-style.png`)),
        consentConfirmed: true,
      };
      const identityReference = config.photoDataUrl
        ? {
            ...dataUrlToReferenceImage(config.photoDataUrl),
            filename: "identity-reference.jpg",
            consentConfirmed: true,
          }
        : null;
      const response = await createGenerationJob({
        agentId: "avatar",
        modality: "image",
        purpose: "avatar_profile",
        prompt: buildAvatarImagePrompt(selectedReference, config, usesUserPhoto ? "identity" : "style", avatarBrief),
        referenceImage: identityReference ? undefined : styleReference,
        referenceImages: identityReference ? [identityReference, styleReference] : undefined,
      });

      setAvatarImageJob(response.job);
      setExpressionRenders([]);
      if (response.job.status === "succeeded") {
        await loadAvatarImageArtifact(response.job.id);
        setStatusText("AI-аватар готов. Теперь можно сделать набор эмоций или сохранить в профиль.");
      } else {
        setStatusText("AI-аватар поставлен в очередь. Обновите статус через несколько секунд.");
      }
    } catch (error) {
      setAvatarImageError(toPublicApiError(error, "Не удалось создать AI-аватар."));
      setStatusText("Генерация AI-аватара не запущена.");
    } finally {
      setAvatarImageBusy(false);
    }
  };

  const refreshAvatarImageJob = async () => {
    if (!avatarImageJob) return;

    setAvatarImageBusy(true);
    setAvatarImageError("");
    try {
      const response = await refreshGenerationJob(avatarImageJob.id);
      setAvatarImageJob(response.job);
      if (response.job.status === "succeeded") {
        await loadAvatarImageArtifact(response.job.id);
        setStatusText("AI-аватар готов.");
      } else if (response.job.status === "failed" || response.job.status === "refunded") {
        setAvatarImageError(response.job.errorMessage ?? "Провайдер не смог создать AI-аватар.");
      }
    } catch (error) {
      setAvatarImageError(toPublicApiError(error, "Не удалось обновить AI-аватар."));
    } finally {
      setAvatarImageBusy(false);
    }
  };

  const loadAvatarImageArtifact = async (jobId: string) => {
    const blob = await fetchGenerationArtifact(jobId);
    if (!blob.type.startsWith("image/")) {
      throw new Error("Провайдер вернул не изображение. Проверьте настройки image generation.");
    }
    const url = rememberObjectUrl(blob);
    setAvatarImageBlob(blob);
    setAvatarImageUrl(url);
  };

  const startExpressionSetRender = async () => {
    if (!avatarImageJob || avatarImageJob.status !== "succeeded") {
      setAvatarImageError("Сначала создайте базовый AI-аватар.");
      return;
    }

    const expressions = avatarExpressionPresets.filter((expression) => selectedExpressionIds.includes(expression.id));
    setExpressionBusy(true);
    setAvatarImageError("");
    setProfileSaveNotice("");
    setStatusText("Создаю набор эмоций на основе готового аватара.");
    setExpressionRenders(expressions.map((expression) => ({ expressionId: expression.id, busy: true })));

    for (const expression of expressions) {
      try {
        const response = await createGenerationJob({
          agentId: "avatar",
          modality: "image",
          purpose: "avatar_profile",
          prompt: buildAvatarExpressionPrompt(selectedReference, expression),
          imageReferenceJobId: avatarImageJob.id,
        });
        setExpressionRenders((current) => upsertExpressionRender(current, expression.id, { job: response.job }));
        if (response.job.status === "succeeded") {
          await loadExpressionArtifact(expression.id, response.job.id);
        } else {
          setExpressionRenders((current) => upsertExpressionRender(current, expression.id, { busy: false }));
        }
      } catch (error) {
        setExpressionRenders((current) =>
          upsertExpressionRender(current, expression.id, {
            busy: false,
            error: toPublicApiError(error, "Не удалось создать эмоцию."),
          })
        );
      }
    }

    setExpressionBusy(false);
    setStatusText("Набор эмоций обработан. Готовые варианты можно использовать для UI-анимации.");
  };

  const loadExpressionArtifact = async (expressionId: AvatarExpressionId, jobId: string) => {
    const blob = await fetchGenerationArtifact(jobId);
    if (!blob.type.startsWith("image/")) {
      throw new Error("Провайдер вернул не изображение.");
    }
    const imageUrl = rememberObjectUrl(blob);
    setExpressionRenders((current) => upsertExpressionRender(current, expressionId, { busy: false, imageUrl }));
    if (activePreview === "base") setActivePreview(expressionId);
  };

  const saveGeneratedAvatarToProfile = async () => {
    if (!avatarImageBlob) {
      setProfileSaveNotice("Сначала создайте AI-аватар.");
      return;
    }
    if (!isAuthenticated) {
      setProfileSaveNotice("Войдите в аккаунт, чтобы сохранить аватар в профиль.");
      return;
    }

    setProfileSaveBusy(true);
    setProfileSaveNotice("");
    try {
      const avatarDataUrl = await blobToProfileAvatarDataUrl(avatarImageBlob);
      await updateProfile({ avatarDataUrl });
      setProfileSaveNotice("AI-аватар сохранен в профиле.");
    } catch (error) {
      setProfileSaveNotice(toPublicApiError(error, "Не удалось сохранить AI-аватар в профиль."));
    } finally {
      setProfileSaveBusy(false);
    }
  };

  const startLiveSession = async () => {
    if (cameraStatus === "starting" || cameraStatus === "live") return;

    setCameraStatus("starting");
    setMicStatus("off");
    setStatusText("Запрашиваю доступ к камере и микрофону.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setupAudio(stream);
      setCameraStatus("live");
      setStatusText("Камера включена. Загружаю MediaPipe Face Landmarker.");
      const faceLandmarker = await ensureFaceLandmarker(faceLandmarkerRef, faceLandmarkerPromiseRef);
      if (faceLandmarker) {
        trackingBackendRef.current = "mediapipe";
        setTrackingBackend("mediapipe");
        setStatusText("Live включен: MediaPipe Face Landmarker управляет 3D-аватаром локально.");
      } else {
        trackingBackendRef.current = "fallback";
        setTrackingBackend("fallback");
        setStatusText("Live включен. MediaPipe не загрузился, работает локальный fallback-трекинг.");
      }
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus("live");
        setMicStatus("blocked");
        setStatusText("Камера включена. Загружаю MediaPipe Face Landmarker без микрофона.");
        const faceLandmarker = await ensureFaceLandmarker(faceLandmarkerRef, faceLandmarkerPromiseRef);
        if (faceLandmarker) {
          trackingBackendRef.current = "mediapipe";
          setTrackingBackend("mediapipe");
          setStatusText("Камера включена: MediaPipe управляет головой и мимикой, микрофон недоступен.");
        } else {
          trackingBackendRef.current = "fallback";
          setTrackingBackend("fallback");
          setStatusText("Камера включена. Микрофон и MediaPipe недоступны, работает fallback-трекинг.");
        }
      } catch {
        setCameraStatus("error");
        setMicStatus("blocked");
        setStatusText("Не удалось включить камеру. Проверьте разрешение браузера.");
      }
    }
  };

  const stopLiveSession = () => {
    cleanupLiveSession();
    trackingRef.current = { yaw: 0, pitch: 0, roll: 0, mouth: 0.04, energy: 0, blinkLeft: 0, blinkRight: 0, brow: 0, smile: 0 };
    setCameraStatus("off");
    setMicStatus("off");
    trackingBackendRef.current = faceLandmarkerRef.current ? "mediapipe" : "fallback";
    setTrackingBackend(trackingBackendRef.current);
    setStatusText("Live-режим остановлен.");
  };

  useEffect(() => {
    if (!isLiveRigEnabled) {
      if (stageMode !== "portrait") {
        setStageMode("portrait");
      }
      setActivePanel((current) => (current === "live" ? "avatar" : current));
      if (cameraStatus === "live" || cameraStatus === "starting") {
        stopLiveSession();
      }
    }
  }, [cameraStatus, isLiveRigEnabled, stageMode, stopLiveSession]);

  const cleanupLiveSession = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    audioDataRef.current = null;
    globalAnalyser = null;
    globalAudioData = null;
    previousFrameRef.current = null;
    lastVideoTimeRef.current = -1;
  };

  const setupAudio = (stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      setMicStatus("blocked");
      return;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      setMicStatus("blocked");
      return;
    }

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    globalAnalyser = analyser;
    globalAudioData = audioDataRef.current;
    setMicStatus("live");
  };

  const saveAvatar = () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ ...config, photoDataUrl: null }));
    setSavedNotice("Настройки сохранены. Исходное фото не хранится в браузере.");
  };

  const resetAvatar = () => {
    setConfig(defaultConfig);
    clearGeneratedAvatar();
    window.localStorage.removeItem(storageKey);
    setSavedNotice("Настройки сброшены.");
  };

  const uploadReferencePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatusText("Выберите изображение в формате JPG, PNG или WebP.");
      return;
    }

    setStatusText("Обрабатываю фото на устройстве.");
    try {
      const photoDataUrl = await prepareAvatarPhoto(file);
      const photoProfile = await extractPhotoProfile(photoDataUrl);
      photoAnalysisSourceRef.current = photoDataUrl;
      clearGeneratedAvatar();
      setConfig((current) => ({ ...current, ...photoProfile, photoDataUrl }));
      setFaceConsent(false);
      setSavedNotice("");
      setStatusText("Фото готово. Выберите направление и подтвердите использование лица.");
    } catch {
      setStatusText("Не удалось прочитать фото. Попробуйте другой файл.");
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const resetReferencePhoto = () => {
    clearGeneratedAvatar();
    updateConfig({ photoDataUrl: null, sculpt: defaultSculpt });
    setFaceConsent(false);
    setStatusText("Фото-основа отключена.");
  };

  const startAvatarVideoRender = async () => {
    const script = videoScript.trim();
    if (!config.photoDataUrl) {
      setRenderError("Сначала загрузите портретное фото.");
      return;
    }
    if (!script) {
      setRenderError("Добавьте текст, который должен произнести аватар.");
      return;
    }
    if (!faceConsent) {
      setRenderError("Подтвердите, что это ваше лицо или у вас есть разрешение.");
      return;
    }

    setRenderBusy(true);
    setRenderError("");
    setStatusText("Отправляю фото и сценарий в avatar video pipeline.");
    if (renderVideoUrl) {
      window.URL.revokeObjectURL(renderVideoUrl);
      setRenderVideoUrl("");
    }

    try {
      const referenceImage = dataUrlToReferenceImage(config.photoDataUrl);
      const response = await createGenerationJob({
        agentId: "avatar",
        modality: "avatar_video",
        prompt: buildAvatarVideoPrompt(script, videoMotion),
        avatarVideo: {
          referenceImage,
          script,
          avatarName: "Personal avatar",
          consentConfirmed: true,
          aspectRatio: "auto",
          expressiveness: "medium",
          motionPrompt: videoMotion.trim() || undefined,
        },
      });

      setRenderJob(response.job);
      if (response.job.status === "succeeded") {
        await loadAvatarVideoArtifact(response.job.id);
      } else {
        setStatusText("Аватар-видео поставлено в обработку. Статус обновляется автоматически.");
      }
    } catch (error) {
      setRenderError(toPublicApiError(error, "Не удалось запустить генерацию аватар-видео."));
      setStatusText("Генерация аватар-видео не запущена.");
    } finally {
      setRenderBusy(false);
    }
  };

  const refreshAvatarVideoJob = async (jobId = renderJob?.id, showBusy = true) => {
    if (!jobId) return;
    if (showBusy) setRenderBusy(true);
    setRenderError("");

    try {
      const response = await refreshGenerationJob(jobId);
      setRenderJob(response.job);
      if (response.job.status === "succeeded") {
        await loadAvatarVideoArtifact(response.job.id);
        setStatusText("Аватар-видео готово.");
      } else if (response.job.status === "refunded" || response.job.status === "failed") {
        setRenderError(response.job.errorMessage ?? "Провайдер не смог собрать аватар-видео.");
        setStatusText("Генерация завершилась ошибкой.");
      }
    } catch (error) {
      setRenderError(toPublicApiError(error, "Не удалось обновить статус аватар-видео."));
    } finally {
      if (showBusy) setRenderBusy(false);
    }
  };

  const cancelAvatarVideoRender = async () => {
    if (!renderJob || (renderJob.status !== "queued" && renderJob.status !== "running")) return;

    setRenderBusy(true);
    setRenderError("");
    try {
      const response = await cancelGenerationJob(renderJob.id);
      setRenderJob(response.job);
      setStatusText("Генерация аватар-видео остановлена.");
    } catch (error) {
      setRenderError(toPublicApiError(error, "Не удалось остановить генерацию."));
    } finally {
      setRenderBusy(false);
    }
  };

  const loadAvatarVideoArtifact = async (jobId: string) => {
    const blob = await fetchGenerationArtifact(jobId);
    const nextUrl = window.URL.createObjectURL(blob);
    setRenderVideoUrl((current) => {
      if (current) window.URL.revokeObjectURL(current);
      return nextUrl;
    });
  };

  return (
    <div className="ns-avatar-root flex h-full min-h-0 text-[var(--text-primary)]">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => void uploadReferencePhoto(event.target.files?.[0])}
      />
      <div className="relative flex min-w-0 flex-1 flex-col p-4 md:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-5 md:p-6">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-gray-300 backdrop-blur">
              <UserRound className="h-4 w-4" strokeWidth={1.7} />
              AI Avatar
            </div>
            <h1 className="ns-avatar-headline mt-3 text-2xl font-medium tracking-normal md:text-3xl">Аватар в вашем стиле</h1>
          </div>
        </div>

        <div className="ns-avatar-stage relative min-h-[560px] flex-1 overflow-hidden" style={{ background: backgroundStyles[config.background] }}>
          <div
            ref={containerRef}
            data-avatar-canvas-root
            className={`absolute inset-0 transition-opacity duration-300 ${stageMode === "liveRig" ? "opacity-100" : "pointer-events-none opacity-0"}`}
          />
          <div
            className={`absolute inset-0 flex items-center justify-center px-6 pb-40 pt-28 transition-opacity duration-300 md:px-12 md:pb-32 md:pt-32 ${
              stageMode === "portrait" ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="relative flex h-full max-h-[780px] w-full max-w-[820px] items-center justify-center">
              <div className="absolute inset-0 rounded-[48px] bg-white/[0.02] blur-3xl" />
              <div className="relative aspect-square w-full max-w-[620px] overflow-hidden rounded-[42px] border border-white/10 bg-black shadow-2xl shadow-black/60">
                <img
                  key={generatedPreviewUrl}
                  src={generatedPreviewUrl}
                  alt="AI-аватар nomduchat"
                  className={`h-full w-full object-cover ${activePreview === "talking" ? "avatar-talk-preview" : "avatar-portrait-preview"}`}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-5 py-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium text-white">
                        {activePreview === "base"
                          ? avatarImageUrl
                            ? selectedReference.title
                            : config.photoDataUrl
                              ? "Ваше фото"
                              : selectedReference.title
                          : avatarExpressionPresets.find((item) => item.id === activePreview)?.title}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">{portraitStateLabel}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-gray-300 backdrop-blur">
                      {avatarImageUrl || activeExpressionRender?.imageUrl
                        ? "По вашему фото"
                        : config.photoDataUrl
                          ? "Исходное фото"
                          : "Пример стиля"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 md:inset-x-5">
          {stageMode === "portrait" ? (
            <div className="ns-avatar-mobile-styles pointer-events-auto mb-2 flex gap-2 overflow-x-auto pb-1 xl:hidden">
              <div
                ref={mobileStylePaletteRef}
                className={`ns-avatar-style-palette ns-avatar-style-palette--mobile ${isStylePaletteOpen ? "is-open" : ""}`}
                onMouseEnter={openStylePalette}
                onMouseLeave={closeStylePalette}
              >
                <button
                  type="button"
                  className="ns-avatar-style-palette-trigger"
                  onClick={toggleStylePalette}
                  onMouseEnter={openStylePalette}
                  aria-expanded={isStylePaletteOpen}
                  aria-label="Выбор стиля аватара"
                >
                  <OptimizedImage src={selectedReference.imageSrc} alt="" loading="eager" />
                  <span>{selectedReference.title}</span>
                  <Palette className="h-4 w-4" strokeWidth={1.8} />
                </button>

                {avatarReferencePresets.map((preset, index) => {
                  const angle = ((360 / avatarReferencePresets.length) * index - 90) * (Math.PI / 180);
                  const radius = 56;
                  const itemHalf = 32;
                  const railLength = radius + itemHalf;
                  const offsetX = Math.round(Math.cos(angle) * radius);
                  const offsetY = Math.round(Math.sin(angle) * radius);
                  return (
                    <span key={`${preset.id}-rail`}>
                      <span
                        aria-hidden="true"
                        className="ns-avatar-style-palette-rail"
                        onMouseEnter={openStylePalette}
                        style={{
                          transform: `translate(-50%, -${railLength}px) rotate(${(angle * 180) / Math.PI}deg)`,
                          transitionDelay: `${Math.min(index * 25, 180)}ms`,
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Выбрать стиль: ${preset.title}`}
                        className={`ns-avatar-style-palette-item ${preset.id === selectedReference.id ? "is-active" : ""}`}
                        onClick={() => {
                          selectReferencePreset(preset);
                          setIsStylePaletteOpen(false);
                        }}
                        onMouseEnter={openStylePalette}
                        style={{
                          transform: isStylePaletteOpen
                            ? `translate(calc(${offsetX}px - 50%), calc(${offsetY}px - 50%)) scale(1)`
                            : "translate(-50%, -50%) scale(0.6)",
                          transitionDelay: `${Math.min(index * 25, 180)}ms`,
                        }}
                      >
                        <OptimizedImage src={preset.imageSrc} alt={preset.title} loading="lazy" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="ns-avatar-dock pointer-events-auto flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between md:p-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setStageMode("portrait"); setActivePanel("avatar"); }}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors ${
                  stageMode === "portrait" ? "bg-white text-black hover:bg-gray-200" : "border border-white/10 bg-black/40 text-gray-300 hover:border-white/20 hover:text-white"
                }`}
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                Портрет
              </button>
              {isLiveRigEnabled ? (
                <button
                  type="button"
                  onClick={() => { setStageMode("liveRig"); setActivePanel("live"); }}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors ${
                    stageMode === "liveRig" ? "bg-white text-black hover:bg-gray-200" : "border border-white/10 bg-black/40 text-gray-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <UserRound className="h-4 w-4" strokeWidth={1.8} />
                  3D
                </button>
              ) : null}
              {stageMode === "portrait" ? (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-gray-200 transition-colors hover:border-white/25 hover:text-white"
                  >
                    <ImageUp className="h-4 w-4" strokeWidth={1.8} />
                    {config.photoDataUrl ? "Заменить фото" : "Загрузить фото"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startAvatarImageRender()}
                    disabled={avatarImageBusy || !config.photoDataUrl || !faceConsent}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--signal-coral)] px-4 text-sm font-semibold text-[#160E1F] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {avatarImageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.8} />}
                    Создать
                  </button>
                </>
              ) : null}
            </div>

            <div className="min-w-0 md:max-w-[360px]">
              {stageMode === "portrait" && config.photoDataUrl ? (
                <label className="flex items-start gap-2 text-xs leading-snug text-gray-300">
                  <input type="checkbox" checked={faceConsent} onChange={(event) => setFaceConsent(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-white" />
                  <span>Разрешаю использовать это фото.</span>
                </label>
              ) : null}
              <p className={`mt-1 line-clamp-2 text-xs ${avatarImageError ? "text-red-200" : "text-gray-500"}`}>
                {avatarImageError || statusText}
              </p>
            </div>
          </div>
        </div>
      </div>

      <aside className="custom-scrollbar hidden w-[360px] shrink-0 overflow-y-auto border-l border-[var(--line-subtle)] bg-[var(--surface-1)] p-5 xl:block">
        <section className="space-y-5">
          <nav className="ns-avatar-panel-tabs" aria-label="Режим Avatar Studio">
            <button type="button" data-active={activePanel === "avatar"} onClick={() => { setActivePanel("avatar"); setStageMode("portrait"); }}>Аватар</button>
            <button type="button" data-active={activePanel === "video"} onClick={() => setActivePanel("video")}>Видео</button>
            {isLiveRigEnabled ? (
              <button type="button" data-active={activePanel === "live"} onClick={() => { setActivePanel("live"); setStageMode("liveRig"); }}>Live</button>
            ) : null}
          </nav>

          {activePanel === "avatar" ? <div className="space-y-5">
          <PanelTitle icon={Sparkles} title="Стиль по вашему фото" />
          <div className="ns-avatar-photo-row">
            <button type="button" onClick={() => photoInputRef.current?.click()}>
              {config.photoDataUrl ? <img src={config.photoDataUrl} alt="Загруженное фото" /> : <ImageUp className="h-5 w-5" strokeWidth={1.8} />}
              <span>{config.photoDataUrl ? "Заменить фото" : "Загрузить фото"}</span>
            </button>
            {config.photoDataUrl ? (
              <button type="button" onClick={resetReferencePhoto} aria-label="Убрать фото" title="Убрать фото">
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
          <div className="space-y-4">
            <div
              ref={desktopStylePaletteRef}
              className={`ns-avatar-style-palette ns-avatar-style-palette--desktop ${isStylePaletteOpen ? "is-open" : ""}`}
              onMouseEnter={openStylePalette}
              onMouseLeave={closeStylePalette}
            >
              <button
                type="button"
                className="ns-avatar-style-palette-trigger"
                onClick={toggleStylePalette}
                onMouseEnter={openStylePalette}
                aria-expanded={isStylePaletteOpen}
                aria-label="Выбор стиля аватара"
              >
                <OptimizedImage src={selectedReference.imageSrc} alt="" loading="eager" />
                <span>Стиль: {selectedReference.title}</span>
                <Palette className="h-4 w-4" strokeWidth={1.8} />
              </button>

              {avatarReferencePresets.map((preset, index) => {
                const angle = ((360 / avatarReferencePresets.length) * index - 90) * (Math.PI / 180);
                const radius = 124;
                const itemHalf = 38;
                const railLength = radius + itemHalf;
                const offsetX = Math.round(Math.cos(angle) * radius);
                const offsetY = Math.round(Math.sin(angle) * radius);
                return (
                  <span key={`${preset.id}-rail`}>
                    <span
                      aria-hidden="true"
                      className="ns-avatar-style-palette-rail"
                      onMouseEnter={openStylePalette}
                      style={{
                        transform: `translate(-50%, -${railLength}px) rotate(${(angle * 180) / Math.PI}deg)`,
                        transitionDelay: `${Math.min(index * 25, 180)}ms`,
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Выбрать стиль: ${preset.title}`}
                      className={`ns-avatar-style-palette-item ${preset.id === selectedReference.id ? "is-active" : ""}`}
                      onClick={() => {
                        selectReferencePreset(preset);
                        setIsStylePaletteOpen(false);
                      }}
                      onMouseEnter={openStylePalette}
                      style={{
                        transform: isStylePaletteOpen
                          ? `translate(calc(${offsetX}px - 50%), calc(${offsetY}px - 50%)) scale(1)`
                          : "translate(-50%, -50%) scale(0.6)",
                        transitionDelay: `${Math.min(index * 25, 180)}ms`,
                      }}
                    >
                      <OptimizedImage src={preset.imageSrc} alt={preset.title} loading="lazy" />
                      <span>{preset.title}</span>
                    </button>
                  </span>
                );
              })}
            </div>

            <details className="ns-avatar-disclosure">
              <summary>
                <span>Уточнить образ</span>
                <span>+</span>
              </summary>
              <textarea
                value={avatarBrief}
                onChange={(event) => setAvatarBrief(event.target.value)}
                rows={3}
                maxLength={600}
                className="mb-3 w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                placeholder="Одежда, характер, фон, настроение"
              />
            </details>

            {config.photoDataUrl ? (
              <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400">
                <input
                  type="checkbox"
                  checked={faceConsent}
                  onChange={(event) => setFaceConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-white"
                />
                <span>Подтверждаю право использовать это фото.</span>
              </label>
            ) : null}

            {avatarImageError ? <div className="rounded-2xl border border-red-300/20 bg-red-950/20 p-3 text-xs text-red-200">{avatarImageError}</div> : null}

            <details className="ns-avatar-disclosure">
              <summary>
                <span>Эмоции</span>
                <span>{avatarExpressionPresets.length}</span>
              </summary>
              <div className="mt-3">
                <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void startExpressionSetRender()}
                  disabled={expressionBusy || !avatarImageJob || avatarImageJob.status !== "succeeded"}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {expressionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.8} />}
                  Набор
                </button>
                </div>
              <div className="grid grid-cols-2 gap-2">
                {avatarExpressionPresets.map((expression) => {
                  const selected = selectedExpressionIds.includes(expression.id);
                  const render = expressionRenders.find((item) => item.expressionId === expression.id);
                  return (
                    <button
                      key={expression.id}
                      type="button"
                      onClick={() => render?.imageUrl ? setActivePreview(expression.id) : toggleExpressionId(expression.id)}
                      className={`flex h-10 items-center justify-between gap-2 rounded-xl border px-3 text-sm transition-colors ${
                        activePreview === expression.id
                          ? "border-white bg-white text-black"
                          : selected
                            ? "border-white/20 bg-white/[0.06] text-gray-200"
                            : "border-white/10 bg-black text-gray-500 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span>{expression.title}</span>
                      {render?.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : render?.imageUrl ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
              {expressionRenders.some((item) => item.error) ? (
                <div className="mt-3 space-y-1 text-xs text-red-200">
                  {expressionRenders.filter((item) => item.error).map((item) => (
                    <div key={item.expressionId}>{avatarExpressionPresets.find((expression) => expression.id === item.expressionId)?.title}: {item.error}</div>
                  ))}
                </div>
              ) : null}
              </div>
            </details>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={() => void saveGeneratedAvatarToProfile()}
                disabled={profileSaveBusy || !avatarImageBlob}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {profileSaveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" strokeWidth={1.8} />}
                В профиль
              </button>
              {avatarImageUrl ? (
                <a
                  href={avatarImageUrl}
                  download="nomduchat-ai-avatar.png"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-3 text-gray-400 transition-colors hover:border-white/20 hover:text-white"
                  aria-label="Скачать AI-аватар"
                  title="Скачать AI-аватар"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                </a>
              ) : null}
            </div>
            {profileSaveNotice ? <div className="rounded-2xl border border-white/10 bg-black p-3 text-xs text-gray-300">{profileSaveNotice}</div> : null}
          </div>
          </div> : null}

          {activePanel === "video" ? <div className="space-y-5">
          <PanelTitle icon={Film} title="AI-видео с лицом" />
          <div className="space-y-3">
            <textarea
              value={videoScript}
              onChange={(event) => setVideoScript(event.target.value)}
              rows={5}
              maxLength={4000}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              placeholder="Текст для аватара"
            />
            <input
              value={videoMotion}
              onChange={(event) => setVideoMotion(event.target.value)}
              maxLength={500}
              className="h-11 w-full rounded-xl border border-white/10 bg-black px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
              placeholder="Подача и движение"
            />
            <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400">
              <input
                type="checkbox"
                checked={faceConsent}
                onChange={(event) => setFaceConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-white"
              />
              <span>Это мое лицо или у меня есть разрешение использовать это фото для AI-видео.</span>
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={() => void startAvatarVideoRender()}
                disabled={renderBusy || !config.photoDataUrl || !faceConsent}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {renderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.8} />}
                Создать видео
              </button>
              {renderJob?.status === "running" || renderJob?.status === "queued" ? (
                <button
                  type="button"
                  onClick={() => void cancelAvatarVideoRender()}
                  disabled={renderBusy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-3 text-gray-400 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Остановить генерацию"
                  title="Остановить генерацию"
                >
                  <CircleStop className="h-4 w-4" strokeWidth={1.8} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void refreshAvatarVideoJob()}
                  disabled={renderBusy || !renderJob}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-3 text-gray-400 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Обновить статус"
                  title="Обновить статус"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
            {renderJob ? (
              <div className="rounded-2xl border border-white/10 bg-black p-3 text-xs text-gray-500">
                <div className="flex items-center justify-between gap-3">
                  <span>{avatarRenderStatusLabel(renderJob.status)}</span>
                  <span>{renderJob.provider ?? "provider"}</span>
                </div>
                {renderJob.errorMessage ? <div className="mt-2 text-red-300">{renderJob.errorMessage}</div> : null}
              </div>
            ) : null}
            {renderError ? <div className="rounded-2xl border border-red-300/20 bg-red-950/20 p-3 text-xs text-red-200">{renderError}</div> : null}
            {renderVideoUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video src={renderVideoUrl} controls playsInline className="aspect-video w-full bg-black object-contain" />
                <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-xs text-emerald-200">
                    <Play className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Готово
                  </div>
                  <a
                    href={renderVideoUrl}
                    download="nomduchat-avatar-video.mp4"
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 px-2 text-gray-400 transition-colors hover:border-white/20 hover:text-white"
                    aria-label="Скачать видео"
                    title="Скачать видео"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
          </div> : null}

          {isLiveRigEnabled && activePanel === "live" ? <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Video className="h-4 w-4" strokeWidth={1.7} />
              {activeStatus}
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                ref={videoRef}
                muted
                playsInline
                className="aspect-video w-full scale-x-[-1] object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatusPill icon={Camera} label={cameraStatus === "live" ? "camera on" : "camera off"} active={cameraStatus === "live"} />
              <StatusPill icon={Mic} label={micStatus === "live" ? "mic on" : "mic local"} active={micStatus === "live"} />
              <StatusPill icon={Sparkles} label={trackingBackend === "mediapipe" ? "face rig" : "fallback"} active={trackingBackend === "mediapipe"} />
            </div>
          </div>

          <PanelTitle icon={ImageUp} title="Фото-основа" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <ImageUp className="h-4 w-4" strokeWidth={1.8} />
              Загрузить фото
            </button>
            <button
              type="button"
              onClick={resetReferencePhoto}
              disabled={!config.photoDataUrl}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-3 text-gray-400 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Убрать фото-основу"
              title="Убрать фото-основу"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
          {config.photoDataUrl ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <img src={config.photoDataUrl} alt="Фото-основа аватара" className="aspect-video w-full object-cover" />
            </div>
          ) : null}

          <PanelTitle icon={UserRound} title="Лицо" />
          <SegmentedControl
            label="Овал лица"
            value={config.faceShape}
            options={["oval", "round", "angular", "long"]}
            labels={faceShapeLabels}
            onChange={(faceShape) => updateConfig({ faceShape })}
          />
          <SegmentedControl
            label="Глаза"
            value={config.eyeStyle}
            options={["calm", "open", "focused"]}
            labels={eyeStyleLabels}
            onChange={(eyeStyle) => updateConfig({ eyeStyle })}
          />
          <SegmentedControl
            label="Брови"
            value={config.browStyle}
            options={["soft", "straight", "arched", "thick"]}
            labels={browStyleLabels}
            onChange={(browStyle) => updateConfig({ browStyle })}
          />
          <SegmentedControl
            label="Очки"
            value={config.glassesStyle}
            options={["none", "round", "square", "thin"]}
            labels={glassesStyleLabels}
            onChange={(glassesStyle) => updateConfig({ glassesStyle })}
          />
          <SegmentedControl
            label="Усы и борода"
            value={config.facialHairStyle}
            options={["none", "mustache", "beard"]}
            labels={facialHairStyleLabels}
            onChange={(facialHairStyle) => updateConfig({ facialHairStyle })}
          />

          <PanelTitle icon={Palette} title="Цвета" />
          <SwatchGroup label="Кожа" value={config.skin} options={skinSwatches} onChange={(skin) => updateConfig({ skin })} />
          <SwatchGroup label="Волосы" value={config.hair} options={hairSwatches} onChange={(hair) => updateConfig({ hair })} />
          <SwatchGroup label="Одежда" value={config.outfit} options={outfitSwatches} onChange={(outfit) => updateConfig({ outfit })} />
          <SwatchGroup label="Акцент" value={config.accent} options={accentSwatches} onChange={(accent) => updateConfig({ accent })} />

          <SegmentedControl
            label="Прическа"
            value={config.hairStyle}
            options={["soft", "short", "bun", "none"]}
            labels={hairStyleLabels}
            onChange={(hairStyle) => updateConfig({ hairStyle })}
          />

          <PanelTitle icon={SlidersHorizontal} title="Движение" />
          <RangeControl
            icon={Video}
            label="Голова"
            value={config.headSensitivity}
            onChange={(headSensitivity) => updateConfig({ headSensitivity })}
          />
          <RangeControl
            icon={Volume2}
            label="Голос"
            value={config.voiceSensitivity}
            onChange={(voiceSensitivity) => updateConfig({ voiceSensitivity })}
          />

          <SegmentedControl
            label="Фон встречи"
            value={config.background}
            options={["studio", "office", "dark"]}
            labels={backgroundLabels}
            onChange={(background) => updateConfig({ background })}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveAvatar}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Save className="h-4 w-4" strokeWidth={1.8} />
              Сохранить
            </button>
            <button
              type="button"
              onClick={resetAvatar}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-3 text-gray-400 transition-colors hover:border-white/20 hover:text-white"
              aria-label="Сбросить аватар"
              title="Сбросить аватар"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
          </div> : null}
        </section>
      </aside>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-white/10 pt-5 text-sm text-gray-500">
      <Icon className="h-4 w-4" strokeWidth={1.7} />
      {title}
    </div>
  );
}

function StatusPill({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${active ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-gray-500"}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {label}
    </div>
  );
}

function SwatchGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm text-gray-500">{label}</div>
      <div className="grid grid-cols-5 gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`relative h-10 rounded-xl border transition-transform hover:scale-[1.03] ${value === option ? "border-white" : "border-white/10"}`}
            style={{ backgroundColor: option }}
            aria-label={`${label}: ${option}`}
            title={option}
          >
            {value === option ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
                <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={2.2} />
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm text-gray-500">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`h-10 rounded-xl border px-3 text-sm transition-colors ${value === option ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white"}`}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeControl({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-gray-500">
          <Icon className="h-4 w-4" strokeWidth={1.7} />
          {label}
        </span>
        <span className="text-gray-600">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.15}
        max={1.3}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-white"
      />
    </label>
  );
}

function createAvatarScene(container: HTMLDivElement, config: AvatarConfig): AvatarSceneHandles {
  const scene = new Scene();
  scene.background = makeSceneBackground(config.background);
  scene.fog = new FogExp2(0x050505, 0.034);

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 1.24, 8.4);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.26;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const keyLight = new DirectionalLight(0xffffff, 3.65);
  keyLight.position.set(3.1, 4.9, 5.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  scene.add(new HemisphereLight(0xf0f5ff, 0x302016, 1.78));
  const fill = new DirectionalLight(0xb4ccff, 1.38);
  fill.position.set(-3.2, 2.2, 3);
  scene.add(fill);
  const rim = new PointLight(config.accent, 5.2, 8);
  rim.position.set(-2.8, 1.8, 2.6);
  scene.add(rim);

  const shadowSkinMaterial = new MeshStandardMaterial({ color: config.skin, roughness: 0.68, metalness: 0.01 });
  shadowSkinMaterial.color.offsetHSL(0, -0.025, -0.035);
  const materials = {
    skin: new MeshPhysicalMaterial({ color: config.skin, roughness: 0.54, metalness: 0.01, sheen: 0.22, sheenColor: new Color("#ffffff"), clearcoat: 0.04 }),
    shadowSkin: shadowSkinMaterial,
    hair: new MeshPhysicalMaterial({ color: config.hair, roughness: 0.68, metalness: 0.01, clearcoat: 0.08, clearcoatRoughness: 0.9 }),
    outfit: new MeshPhysicalMaterial({ color: config.outfit, roughness: 0.38, metalness: 0.04, sheen: 0.35 }),
    accent: new MeshStandardMaterial({ color: config.accent, emissive: config.accent, emissiveIntensity: 0.18, roughness: 0.32 }),
  };
  const shirtMaterial = new MeshStandardMaterial({ color: "#F5F7FA", roughness: 0.52, metalness: 0.01 });

  const root = new Group();
  root.position.y = -0.08;
  root.scale.setScalar(0.68);
  scene.add(root);

  const body = new Group();
  body.position.y = -1.08;
  root.add(body);

  const torso = new Mesh(new CylinderGeometry(0.52, 0.96, 1.82, 48), materials.outfit);
  torso.position.set(0, -0.1, 0);
  torso.scale.set(1.02, 1, 0.46);
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const shirt = new Mesh(new BoxGeometry(0.42, 1.36, 0.035), shirtMaterial);
  shirt.position.set(0, 0.04, 0.45);
  shirt.castShadow = true;
  body.add(shirt);

  const tie = new Mesh(new BoxGeometry(0.11, 0.86, 0.045), materials.accent);
  tie.position.set(0, -0.08, 0.49);
  tie.rotation.z = 0.02;
  body.add(tie);

  const leftLapel = new Mesh(new BoxGeometry(0.12, 1.3, 0.05), materials.outfit);
  leftLapel.position.set(-0.24, 0.08, 0.52);
  leftLapel.rotation.z = -0.18;
  body.add(leftLapel);
  const rightLapel = leftLapel.clone();
  rightLapel.position.x = 0.24;
  rightLapel.rotation.z = 0.18;
  body.add(rightLapel);

  const neck = new Mesh(new CylinderGeometry(0.24, 0.29, 0.52, 32), materials.skin);
  neck.position.set(0, 0.96, 0.01);
  neck.castShadow = true;
  neck.receiveShadow = true;
  body.add(neck);

  const shoulderGeometry = new SphereGeometry(0.5, 36, 18);
  const leftShoulder = new Mesh(shoulderGeometry, materials.outfit);
  leftShoulder.position.set(-0.66, 0.26, 0.04);
  leftShoulder.scale.set(1.15, 0.34, 0.5);
  leftShoulder.castShadow = true;
  body.add(leftShoulder);
  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = 0.66;
  body.add(rightShoulder);

  const leftArm = new Mesh(new CapsuleGeometry(0.2, 0.82, 8, 24), materials.outfit);
  leftArm.position.set(-0.86, -0.42, -0.06);
  leftArm.rotation.z = 0.08;
  leftArm.scale.set(0.72, 0.74, 0.48);
  leftArm.castShadow = true;
  body.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.86;
  rightArm.rotation.z = -0.08;
  body.add(rightArm);

  const head = new Group();
  head.position.y = 0.72;
  root.add(head);

  const face = new Mesh(new SphereGeometry(0.86, 96, 64), materials.skin);
  face.scale.set(0.8, 0.98, 0.66);
  face.castShadow = true;
  face.receiveShadow = true;
  head.add(face);

  const jaw = new Mesh(new SphereGeometry(0.34, 48, 24), materials.skin);
  jaw.position.set(0, -0.68, 0.28);
  jaw.scale.set(1.1, 0.34, 0.46);
  jaw.castShadow = false;
  jaw.receiveShadow = false;
  jaw.visible = false;
  head.add(jaw);

  const leftEar = new Mesh(new SphereGeometry(0.17, 28, 20), shadowSkinMaterial);
  leftEar.position.set(-0.65, -0.06, -0.04);
  leftEar.scale.set(0.48, 0.96, 0.24);
  leftEar.castShadow = true;
  head.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.65;
  head.add(rightEar);

  const hairParts: Object3D[] = [];
  const hairCap = new Mesh(new SphereGeometry(0.88, 96, 38, 0, Math.PI * 2, 0, Math.PI * 0.5), materials.hair);
  hairCap.name = "hair-cap";
  hairCap.position.set(0, 0.43, -0.06);
  hairCap.scale.set(0.8, 0.68, 0.66);
  hairCap.castShadow = true;
  head.add(hairCap);
  hairParts.push(hairCap);

  const crownHair = new Mesh(new SphereGeometry(0.42, 40, 18), materials.hair);
  crownHair.name = "hair-cap";
  crownHair.position.set(0.04, 0.6, -0.05);
  crownHair.scale.set(1.04, 0.32, 0.78);
  crownHair.castShadow = true;
  head.add(crownHair);
  hairParts.push(crownHair);

  const shortHairline = new Mesh(new CapsuleGeometry(0.018, 0.72, 6, 18), materials.hair);
  shortHairline.name = "hair-short";
  shortHairline.position.set(0, 0.39, 0.49);
  shortHairline.rotation.z = Math.PI / 2;
  shortHairline.scale.set(1, 0.9, 0.36);
  shortHairline.castShadow = true;
  head.add(shortHairline);
  hairParts.push(shortHairline);

  const leftHair = new Mesh(new CapsuleGeometry(0.12, 0.52, 8, 20), materials.hair);
  leftHair.name = "hair-side";
  leftHair.position.set(-0.57, -0.1, 0.08);
  leftHair.rotation.z = 0.08;
  leftHair.scale.set(0.52, 0.95, 0.38);
  leftHair.castShadow = true;
  head.add(leftHair);
  hairParts.push(leftHair);
  const rightHair = leftHair.clone();
  rightHair.name = "hair-side";
  rightHair.position.x = 0.58;
  rightHair.rotation.z = -0.08;
  head.add(rightHair);
  hairParts.push(rightHair);

  const bun = new Mesh(new SphereGeometry(0.24, 28, 20), materials.hair);
  bun.name = "hair-bun";
  bun.position.set(0, 0.26, -0.64);
  bun.scale.set(1.18, 1.04, 0.9);
  bun.castShadow = true;
  head.add(bun);
  hairParts.push(bun);

  const eyeMaterial = new MeshStandardMaterial({ color: "#F8FAFC", roughness: 0.14 });
  const pupilMaterial = new MeshStandardMaterial({ color: "#101113", roughness: 0.22 });
  const irisMaterial = new MeshStandardMaterial({ color: "#4B6477", roughness: 0.18 });
  const leftEye = createEye(eyeMaterial, pupilMaterial);
  const leftIris = createIris(irisMaterial);
  leftEye.add(leftIris);
  leftEye.position.set(-0.22, 0.06, 0.55);
  head.add(leftEye);
  const rightEye = createEye(eyeMaterial, pupilMaterial);
  const rightIris = createIris(irisMaterial);
  rightEye.add(rightIris);
  rightEye.position.set(0.22, 0.06, 0.55);
  head.add(rightEye);

  const leftLid = createEyelid(materials.skin);
  leftLid.position.set(-0.22, 0.093, 0.558);
  head.add(leftLid);
  const rightLid = createEyelid(materials.skin);
  rightLid.position.set(0.22, 0.093, 0.558);
  head.add(rightLid);

  const leftBrow = createBrow(materials.hair);
  leftBrow.position.set(-0.26, 0.28, 0.56);
  leftBrow.rotation.z = -0.06;
  head.add(leftBrow);
  const rightBrow = createBrow(materials.hair);
  rightBrow.position.set(0.26, 0.28, 0.56);
  rightBrow.rotation.z = 0.06;
  head.add(rightBrow);

  const glasses = new Group();
  const glassesRound = createGlasses("round");
  const glassesSquare = createGlasses("square");
  const glassesThin = createGlasses("thin");
  glasses.add(glassesRound, glassesSquare, glassesThin);
  head.add(glasses);

  const mouth = createMemojiMouth(new MeshStandardMaterial({ color: "#2A171D", roughness: 0.42 }));
  mouth.position.set(0, -0.38, 0.646);
  mouth.scale.set(1, 1, 1);
  head.add(mouth);

  const lipMaterial = shadowSkinMaterial.clone();
  lipMaterial.transparent = true;
  lipMaterial.opacity = 0.34;
  const lowerLip = new Mesh(new CapsuleGeometry(0.006, 0.15, 4, 16), lipMaterial);
  lowerLip.position.set(0, -0.423, 0.586);
  lowerLip.rotation.z = Math.PI / 2;
  lowerLip.scale.set(0.9, 0.26, 0.22);
  head.add(lowerLip);

  const facialHair = new Group();
  const { mustache, beard } = createFacialHair(materials.hair);
  facialHair.add(mustache, beard);
  head.add(facialHair);

  const nose = new Mesh(new CapsuleGeometry(0.035, 0.055, 8, 18), shadowSkinMaterial);
  nose.position.set(0, -0.11, 0.606);
  nose.scale.set(0.82, 0.96, 0.5);
  nose.castShadow = true;
  head.add(nose);
  const nostrilMaterial = new MeshBasicMaterial({ color: "#2A171D", transparent: true, opacity: 0.36, depthWrite: false });
  const leftNostril = new Mesh(new CircleGeometry(0.008, 14), nostrilMaterial);
  leftNostril.position.set(-0.022, -0.147, 0.646);
  leftNostril.scale.set(1.2, 0.7, 1);
  head.add(leftNostril);
  const rightNostril = leftNostril.clone();
  rightNostril.position.x = 0.022;
  head.add(rightNostril);

  const noseBridgeMaterial = shadowSkinMaterial.clone();
  noseBridgeMaterial.transparent = true;
  noseBridgeMaterial.opacity = 0.42;
  const noseBridge = new Mesh(new CapsuleGeometry(0.009, 0.17, 6, 16), noseBridgeMaterial);
  noseBridge.position.set(0, 0.02, 0.588);
  noseBridge.scale.set(0.72, 1, 0.32);
  noseBridge.castShadow = false;
  head.add(noseBridge);

  const chinShadowMaterial = shadowSkinMaterial.clone();
  chinShadowMaterial.transparent = true;
  chinShadowMaterial.opacity = 0.18;
  const chinShadow = new Mesh(new CapsuleGeometry(0.008, 0.18, 4, 16), chinShadowMaterial);
  chinShadow.position.set(0, -0.66, 0.51);
  chinShadow.rotation.z = Math.PI / 2;
  chinShadow.scale.set(0.72, 0.22, 0.18);
  head.add(chinShadow);

  const cheekMaterial = new MeshBasicMaterial({ color: "#F2B49D", transparent: true, opacity: 0.16, depthWrite: false });
  const leftCheek = createCheek(cheekMaterial);
  leftCheek.position.set(-0.32, -0.18, 0.565);
  head.add(leftCheek);
  const rightCheek = createCheek(cheekMaterial);
  rightCheek.position.set(0.32, -0.18, 0.565);
  head.add(rightCheek);

  const floor = new Mesh(
    new CircleGeometry(3.1, 96),
    new MeshStandardMaterial({ color: "#111417", roughness: 0.9, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.12;
  floor.receiveShadow = true;
  scene.add(floor);

  createBackdrop(scene, materials.accent);

  hairParts.forEach((part) => {
    part.visible = isHairPartVisible(part.name, config.hairStyle);
  });

  const { premiumAvatar, premiumTextureState } = createPremiumAvatarBillboard(scene, root, config);

  const handles = {
    root,
    premiumAvatar,
    head,
    face,
    jaw,
    nose,
    noseBridge,
    mouth,
    leftEye,
    rightEye,
    leftLid,
    rightLid,
    leftBrow,
    rightBrow,
    facialHair,
    mustache,
    beard,
    glasses,
    glassesRound,
    glassesSquare,
    glassesThin,
    leftCheek,
    rightCheek,
    body,
    materials,
    hairParts,
    renderer,
    scene,
    camera,
    premiumTextureState,
    premiumBaseScale: 1,
  };
  applyAvatarSculpt(handles, config);
  resizeScene(container, handles);
  return handles;
}

function createPremiumAvatarBillboard(scene: Scene, fallbackRoot: Group, config: AvatarConfig) {
  const premiumAvatar = new Group();
  premiumAvatar.position.set(0, 0.28, 0.72);
  premiumAvatar.visible = false;
  scene.add(premiumAvatar);
  fallbackRoot.visible = true;

  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Avatar canvas context is unavailable.");
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const premiumTextureState: PremiumAvatarTextureState = { image: null, photoImage: null, photoSource: null, canvas, context, texture };

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    toneMapped: true,
  });

  const plane = new Mesh(new PlaneGeometry(4.32, 3.46), material);
  plane.visible = false;
  premiumAvatar.add(plane);

  const image = new Image();
  image.onload = () => {
    premiumTextureState.image = image;
    updatePremiumAvatarTexture(premiumTextureState, config);
    plane.visible = false;
    fallbackRoot.visible = true;
  };
  image.onerror = () => {
    if (image.src.endsWith(".webp")) {
      image.src = "/avatar/premium-business-avatar.png";
      return;
    }
    plane.visible = false;
    fallbackRoot.visible = true;
  };
  image.src = "/avatar/premium-business-avatar.webp";

  const glowMaterial = new MeshBasicMaterial({ color: "#20E3B2", transparent: true, opacity: 0.08, depthWrite: false });
  const glow = new Mesh(new CircleGeometry(1.55, 80), glowMaterial);
  glow.position.set(0, -1.46, -0.04);
  glow.scale.set(1.9, 0.34, 1);
  premiumAvatar.add(glow);

  return { premiumAvatar, premiumTextureState };
}

function updatePremiumAvatarTexture(state: PremiumAvatarTextureState | null, config: AvatarConfig) {
  if (!state?.image) return;
  syncReferencePhotoImage(state, config);

  const { image, canvas, context, texture } = state;
  if (canvas.width !== image.naturalWidth || canvas.height !== image.naturalHeight) {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const skin = hexToRgb(config.skin);
  const hair = hexToRgb(config.hair);
  const outfit = hexToRgb(config.outfit);
  const accent = hexToRgb(config.accent);

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 12) continue;

    const pixel = index / 4;
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    const nx = x / canvas.width;
    const ny = y / canvas.height;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const faceOvalZone = nx > 0.26 && nx < 0.74 && ny > 0.32 && ny < 0.68;
    const skinLike = r > 84 && r > g * 0.98 && g > b * 0.92 && ny < 0.72 && (faceOvalZone || r > g * 1.03);
    const accentLike = ny > 0.48 && g > 120 && b > 85 && g > r * 1.22 && b > r * 1.1;
    const hairLike = ny < 0.53 && r < 92 && g < 88 && b < 122 && !(faceOvalZone && ny > 0.38);
    const outfitLike = ny > 0.57 && lum < 132 && b > r * 0.72 && !skinLike;

    if (skinLike) {
      tintPixel(pixels, index, skin, 0.38);
    } else if (accentLike) {
      tintPixel(pixels, index, accent, 0.88);
    } else if (hairLike) {
      tintPixel(pixels, index, hair, 0.72);
    } else if (outfitLike) {
      tintPixel(pixels, index, outfit, 0.68);
    }
  }

  context.putImageData(imageData, 0, 0);
  if (state.photoImage) {
    drawReferencePhotoOnAvatar(context, state.photoImage, canvas.width, canvas.height);
  }
  texture.needsUpdate = true;
}

function syncReferencePhotoImage(state: PremiumAvatarTextureState, config: AvatarConfig) {
  if (!config.photoDataUrl) {
    state.photoSource = null;
    state.photoImage = null;
    return;
  }
  if (state.photoSource === config.photoDataUrl) return;

  state.photoSource = config.photoDataUrl;
  state.photoImage = null;
  const image = new Image();
  image.onload = () => {
    if (state.photoSource !== config.photoDataUrl) return;
    state.photoImage = image;
    updatePremiumAvatarTexture(state, config);
  };
  image.onerror = () => {
    if (state.photoSource === config.photoDataUrl) {
      state.photoSource = null;
      state.photoImage = null;
    }
  };
  image.src = config.photoDataUrl;
}

function drawReferencePhotoOnAvatar(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const headX = width * 0.335;
  const headY = height * 0.058;
  const headWidth = width * 0.33;
  const headHeight = height * 0.58;
  const centerX = headX + headWidth / 2;
  const centerY = headY + headHeight * 0.5;
  const softLayer = createReferencePhotoLayer(image, headWidth, headHeight, 2.55, 0.2, "blur(2.4px) saturate(0.82) contrast(0.72) brightness(1.08)");
  const toneLayer = createReferencePhotoLayer(image, headWidth, headHeight, 2.35, 0.2, "blur(1.2px) saturate(0.92) contrast(0.78) brightness(1.04)");
  const detailLayer = createReferencePhotoLayer(image, headWidth, headHeight, 2.85, 0.18, "saturate(0.35) contrast(0.7) brightness(1.06)");

  context.save();
  context.beginPath();
  context.ellipse(centerX, centerY, headWidth * 0.5, headHeight * 0.51, 0, 0, Math.PI * 2);
  context.clip();

  if (softLayer) {
    context.globalCompositeOperation = "soft-light";
    context.globalAlpha = 0.2;
    context.drawImage(softLayer, headX, headY, headWidth, headHeight);
  }
  if (toneLayer) {
    context.globalCompositeOperation = "color";
    context.globalAlpha = 0.09;
    context.drawImage(toneLayer, headX, headY, headWidth, headHeight);
  }
  if (detailLayer) {
    context.globalCompositeOperation = "luminosity";
    context.globalAlpha = 0.055;
    context.drawImage(detailLayer, headX, headY, headWidth, headHeight);
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "multiply";
  const gradient = context.createLinearGradient(headX, headY, headX + headWidth, headY + headHeight);
  gradient.addColorStop(0, "rgba(15, 23, 42, 0.05)");
  gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.01)");
  gradient.addColorStop(1, "rgba(15, 23, 42, 0.04)");
  context.fillStyle = gradient;
  context.fillRect(headX, headY, headWidth, headHeight);
  context.restore();
}

function createReferencePhotoLayer(image: HTMLImageElement, width: number, height: number, zoom: number, yBias: number, filter: string) {
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.round(width));
  layer.height = Math.max(1, Math.round(height));
  const layerContext = layer.getContext("2d");
  if (!layerContext) return null;

  layerContext.filter = filter;
  drawImageCoverZoom(layerContext, image, 0, 0, layer.width, layer.height, zoom, yBias);
  layerContext.filter = "none";
  layerContext.globalCompositeOperation = "destination-in";
  layerContext.save();
  layerContext.translate(layer.width / 2, layer.height * 0.5);
  layerContext.scale(1, 1.06);
  const mask = layerContext.createRadialGradient(0, 0, layer.width * 0.18, 0, 0, layer.width * 0.5);
  mask.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  mask.addColorStop(0.68, "rgba(0, 0, 0, 0.44)");
  mask.addColorStop(1, "rgba(0, 0, 0, 0)");
  layerContext.fillStyle = mask;
  layerContext.beginPath();
  layerContext.arc(0, 0, layer.width * 0.5, 0, Math.PI * 2);
  layerContext.fill();
  layerContext.restore();
  layerContext.globalCompositeOperation = "source-over";

  return layer;
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = width / scale;
  const scaledHeight = height / scale;
  const sourceX = (sourceWidth - scaledWidth) / 2;
  const sourceY = Math.max(0, (sourceHeight - scaledHeight) * 0.28);
  context.drawImage(image, sourceX, sourceY, scaledWidth, scaledHeight, x, y, width, height);
}

function drawImageCoverZoom(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
  yBias: number
) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const baseScale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = Math.min(sourceWidth, width / baseScale / zoom);
  const scaledHeight = Math.min(sourceHeight, height / baseScale / zoom);
  const sourceX = (sourceWidth - scaledWidth) / 2;
  const sourceY = Math.max(0, (sourceHeight - scaledHeight) * yBias);
  context.drawImage(image, sourceX, sourceY, scaledWidth, scaledHeight, x, y, width, height);
}

function tintPixel(pixels: Uint8ClampedArray, index: number, color: RgbColor, amount: number) {
  const r = pixels[index];
  const g = pixels[index + 1];
  const b = pixels[index + 2];
  const sourceLum = Math.max(18, r * 0.2126 + g * 0.7152 + b * 0.0722);
  const targetLum = Math.max(18, color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722);
  const factor = clamp(sourceLum / targetLum, 0.42, 1.72);

  pixels[index] = mix(r, clamp(color.r * factor, 0, 255), amount);
  pixels[index + 1] = mix(g, clamp(color.g * factor, 0, 255), amount);
  pixels[index + 2] = mix(b, clamp(color.b * factor, 0, 255), amount);
}

function applyAvatarSculpt(handles: AvatarSceneHandles, config: AvatarConfig) {
  const sculpt = config.sculpt;
  const faceShape = getFaceShapeTuning(config.faceShape);
  const eyeStyle = getEyeStyleTuning(config.eyeStyle);
  const browStyle = getBrowStyleTuning(config.browStyle);

  const faceWidth = sculpt.faceWidth * faceShape.faceWidth;
  const faceLength = sculpt.faceLength * faceShape.faceLength;
  const jawWidth = sculpt.jawWidth * faceShape.jawWidth;
  const eyeSize = sculpt.eyeSize * eyeStyle.eyeSize;
  const eyeX = 0.255 * sculpt.eyeSpacing * eyeStyle.eyeSpacing;
  const browX = 0.285 * sculpt.eyeSpacing * eyeStyle.eyeSpacing;
  const browY = 0.26 + sculpt.browLift * 0.05 + browStyle.y;

  handles.face.scale.set(0.8 * faceWidth, 0.98 * faceLength, 0.66);
  handles.jaw.position.y = -0.72 * faceLength + faceShape.jawY;
  handles.jaw.position.z = 0.29;
  handles.jaw.scale.set(1.02 * jawWidth, 0.32 * faceLength * faceShape.jawHeight, 0.42);
  handles.leftCheek.position.set(-0.33 * faceWidth, -0.18 + faceShape.cheekY, 0.61);
  handles.rightCheek.position.set(0.33 * faceWidth, -0.18 + faceShape.cheekY, 0.61);
  handles.leftCheek.scale.set(1.7 * faceShape.cheekScale, 0.78, 1);
  handles.rightCheek.scale.set(1.7 * faceShape.cheekScale, 0.78, 1);

  handles.leftEye.position.set(-eyeX, 0.045 + eyeStyle.y, 0.625);
  handles.rightEye.position.set(eyeX, 0.045 + eyeStyle.y, 0.625);
  handles.leftEye.scale.set(eyeSize * eyeStyle.width, eyeSize * eyeStyle.height, eyeSize);
  handles.rightEye.scale.set(eyeSize * eyeStyle.width, eyeSize * eyeStyle.height, eyeSize);
  handles.leftEye.userData.baseScale = eyeSize * eyeStyle.height;
  handles.rightEye.userData.baseScale = eyeSize * eyeStyle.height;
  handles.leftLid.position.set(-eyeX, 0.107 + eyeStyle.y + eyeStyle.lidY, 0.633);
  handles.rightLid.position.set(eyeX, 0.107 + eyeStyle.y + eyeStyle.lidY, 0.633);
  handles.leftLid.scale.set(1.42 * eyeStyle.width, eyeStyle.lidScale, 0.18);
  handles.rightLid.scale.set(1.42 * eyeStyle.width, eyeStyle.lidScale, 0.18);

  handles.leftBrow.position.set(-browX, browY, 0.635);
  handles.rightBrow.position.set(browX, browY, 0.635);
  handles.leftBrow.rotation.z = Math.PI / 2 + browStyle.leftTilt;
  handles.rightBrow.rotation.z = Math.PI / 2 + browStyle.rightTilt;
  handles.leftBrow.scale.set(browStyle.thickness, browStyle.width * eyeSize, 0.46);
  handles.rightBrow.scale.set(browStyle.thickness, browStyle.width * eyeSize, 0.46);
  handles.leftBrow.userData.baseY = browY;
  handles.rightBrow.userData.baseY = browY;

  handles.nose.scale.set(0.82 * sculpt.noseWidth * faceShape.noseWidth, 0.96 * sculpt.noseLength, 0.5);
  handles.noseBridge.scale.set(0.66 * sculpt.noseWidth * faceShape.noseWidth, sculpt.noseLength, 0.28);
  handles.mouth.userData.baseWidth = sculpt.mouthWidth * faceShape.mouthWidth;
  handles.facialHair.position.set(0, 0, 0);
  handles.mustache.visible = config.facialHairStyle === "mustache" || config.facialHairStyle === "beard";
  handles.beard.visible = config.facialHairStyle === "beard";

  handles.glasses.visible = config.glassesStyle !== "none";
  handles.glasses.position.set(0, 0.047 + eyeStyle.y, 0.657);
  handles.glasses.scale.set(1.08 * sculpt.eyeSpacing * eyeStyle.eyeSpacing, 1.12 * eyeSize, 1);
  handles.glassesRound.visible = config.glassesStyle === "round";
  handles.glassesSquare.visible = config.glassesStyle === "square";
  handles.glassesThin.visible = config.glassesStyle === "thin";
}

function getFaceShapeTuning(faceShape: FaceShape) {
  if (faceShape === "round") {
    return {
      faceWidth: 1.08,
      faceLength: 0.95,
      jawWidth: 1.06,
      jawHeight: 0.9,
      jawY: 0.05,
      cheekY: 0.03,
      cheekScale: 1.16,
      noseWidth: 0.95,
      mouthWidth: 1.04,
    };
  }
  if (faceShape === "angular") {
    return {
      faceWidth: 0.99,
      faceLength: 1,
      jawWidth: 1.16,
      jawHeight: 1.06,
      jawY: -0.025,
      cheekY: -0.015,
      cheekScale: 1.02,
      noseWidth: 1.02,
      mouthWidth: 0.98,
    };
  }
  if (faceShape === "long") {
    return {
      faceWidth: 0.93,
      faceLength: 1.13,
      jawWidth: 0.94,
      jawHeight: 1.12,
      jawY: -0.05,
      cheekY: -0.045,
      cheekScale: 0.92,
      noseWidth: 0.97,
      mouthWidth: 0.95,
    };
  }

  return {
    faceWidth: 1,
    faceLength: 1,
    jawWidth: 1,
    jawHeight: 1,
    jawY: 0,
    cheekY: 0,
    cheekScale: 1,
    noseWidth: 1,
    mouthWidth: 1,
  };
}

function getEyeStyleTuning(eyeStyle: EyeStyle) {
  if (eyeStyle === "open") {
    return { eyeSize: 1.06, eyeSpacing: 1.01, width: 1.04, height: 1.18, y: 0.012, lidY: 0.014, lidScale: 0.34 };
  }
  if (eyeStyle === "focused") {
    return { eyeSize: 0.97, eyeSpacing: 0.99, width: 1.08, height: 0.84, y: -0.008, lidY: -0.008, lidScale: 0.68 };
  }
  return { eyeSize: 1, eyeSpacing: 1, width: 1, height: 1, y: 0, lidY: 0, lidScale: 0.5 };
}

function getBrowStyleTuning(browStyle: BrowStyle) {
  if (browStyle === "straight") {
    return { y: -0.012, width: 1.1, thickness: 0.95, leftTilt: 0, rightTilt: 0 };
  }
  if (browStyle === "arched") {
    return { y: 0.022, width: 1.02, thickness: 0.92, leftTilt: -0.18, rightTilt: 0.18 };
  }
  if (browStyle === "thick") {
    return { y: 0.004, width: 1.12, thickness: 1.35, leftTilt: -0.06, rightTilt: 0.06 };
  }
  return { y: 0, width: 1, thickness: 1, leftTilt: -0.08, rightTilt: 0.08 };
}

function createGlasses(style: Exclude<GlassesStyle, "none">) {
  const group = new Group();

  const material = new MeshStandardMaterial({ color: style === "round" ? "#F4C84A" : style === "thin" ? "#31343A" : "#17181C", roughness: 0.24, metalness: style === "round" ? 0.55 : 0.35 });
  const lensMaterial = new MeshPhysicalMaterial({
    color: "#DDE7F5",
    transparent: true,
    opacity: style === "thin" ? 0.11 : 0.16,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.15,
    depthWrite: false,
  });

  if (style === "square") {
    addSquareLens(group, -0.22, material, lensMaterial);
    addSquareLens(group, 0.22, material, lensMaterial);
  } else {
    const rimTube = style === "thin" ? 0.0045 : 0.0085;
    const rimRadius = style === "round" ? 0.112 : 0.095;
    const leftRim = new Mesh(new TorusGeometry(rimRadius, rimTube, 8, 42), material);
    leftRim.position.x = -0.25;
    leftRim.scale.set(style === "round" ? 1.05 : 1.32, style === "round" ? 1 : 0.72, 1);
    group.add(leftRim);
    const rightRim = leftRim.clone();
    rightRim.position.x = 0.25;
    group.add(rightRim);

    const leftLens = new Mesh(new CircleGeometry(style === "round" ? 0.102 : 0.092, 42), lensMaterial);
    leftLens.position.set(-0.25, 0, -0.004);
    leftLens.scale.set(style === "round" ? 1.06 : 1.32, style === "round" ? 1 : 0.72, 1);
    group.add(leftLens);
    const rightLens = leftLens.clone();
    rightLens.position.x = 0.25;
    group.add(rightLens);
  }

  const bridge = new Mesh(new CapsuleGeometry(style === "thin" ? 0.004 : 0.007, style === "round" ? 0.18 : 0.14, 4, 12), material);
  bridge.rotation.z = Math.PI / 2;
  group.add(bridge);

  const templeRadius = style === "thin" ? 0.004 : 0.006;
  const leftTemple = new Mesh(new CapsuleGeometry(templeRadius, 0.22, 4, 10), material);
  leftTemple.position.set(style === "round" ? -0.39 : -0.36, 0.01, -0.03);
  leftTemple.rotation.y = 0.95;
  group.add(leftTemple);
  const rightTemple = leftTemple.clone();
  rightTemple.position.x = style === "round" ? 0.39 : 0.36;
  rightTemple.rotation.y = -0.95;
  group.add(rightTemple);

  return group;
}

function addSquareLens(group: Group, x: number, material: Material, lensMaterial: Material) {
  const lens = new Mesh(new ShapeGeometry(createRoundedRectShape(0.25, 0.14, 0.03)), lensMaterial);
  lens.position.set(x, 0, -0.004);
  group.add(lens);

  const top = createFrameBar(material, 0.22, true);
  top.position.set(x, 0.078, 0);
  group.add(top);
  const bottom = createFrameBar(material, 0.22, true);
  bottom.position.set(x, -0.078, 0);
  group.add(bottom);
  const left = createFrameBar(material, 0.12, false);
  left.position.set(x - 0.13, 0, 0);
  group.add(left);
  const right = createFrameBar(material, 0.12, false);
  right.position.set(x + 0.13, 0, 0);
  group.add(right);
}

function createFrameBar(material: Material, length: number, horizontal: boolean) {
  const bar = new Mesh(new CapsuleGeometry(0.0065, length, 4, 10), material);
  if (horizontal) bar.rotation.z = Math.PI / 2;
  return bar;
}

function createRoundedRectShape(width: number, height: number, radius: number) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function hexToRgb(value: string): RgbColor {
  const normalized = value.replace("#", "");
  const numeric = Number.parseInt(normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function rgbToHex(color: RgbColor) {
  const r = Math.round(clamp(color.r, 0, 255)).toString(16).padStart(2, "0");
  const g = Math.round(clamp(color.g, 0, 255)).toString(16).padStart(2, "0");
  const b = Math.round(clamp(color.b, 0, 255)).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function createEye(eyeMaterial: Material, pupilMaterial: Material) {
  const eye = new Group();
  const white = new Mesh(new CircleGeometry(0.082, 48), eyeMaterial);
  white.scale.set(1.28, 0.7, 1);
  eye.add(white);
  const pupil = new Mesh(new CircleGeometry(0.018, 24), pupilMaterial);
  pupil.position.z = 0.009;
  pupil.scale.set(1, 0.92, 1);
  eye.add(pupil);
  const catchLight = new Mesh(new CircleGeometry(0.006, 14), new MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.92 }));
  catchLight.position.set(-0.007, 0.008, 0.012);
  eye.add(catchLight);
  return eye;
}

function createIris(material: Material) {
  const iris = new Mesh(new CircleGeometry(0.034, 28), material);
  iris.position.z = 0.006;
  iris.scale.set(1, 0.86, 1);
  return iris;
}

function createBrow(material: Material) {
  const brow = new Mesh(new CapsuleGeometry(0.022, 0.24, 6, 18), material);
  brow.rotation.z = Math.PI / 2;
  brow.scale.z = 0.5;
  return brow;
}

function createEyelid(material: Material) {
  const lid = new Mesh(new CapsuleGeometry(0.01, 0.12, 4, 12), material);
  lid.rotation.z = Math.PI / 2;
  lid.scale.set(1.2, 0.22, 0.18);
  return lid;
}

function createMemojiMouth(material: Material) {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.13, 0.006, 0),
    new Vector3(-0.04, -0.008, 0),
    new Vector3(0.04, -0.008, 0),
    new Vector3(0.13, 0.006, 0),
  ]);
  return new Mesh(new TubeGeometry(curve, 28, 0.01, 8, false), material);
}

function createFacialHair(material: Material) {
  const mustache = new Group();
  const leftMustache = new Mesh(new CapsuleGeometry(0.014, 0.145, 6, 18), material);
  leftMustache.position.set(-0.07, -0.255, 0.642);
  leftMustache.rotation.z = Math.PI / 2 - 0.12;
  leftMustache.scale.z = 0.34;
  mustache.add(leftMustache);
  const rightMustache = leftMustache.clone();
  rightMustache.position.x = 0.07;
  rightMustache.rotation.z = Math.PI / 2 + 0.12;
  mustache.add(rightMustache);

  const beard = new Group();
  const beardMain = new Mesh(createBeardShapeGeometry(), material);
  beardMain.position.set(0, -0.36, 0.62);
  beard.add(beardMain);

  mustache.visible = false;
  beard.visible = false;
  return { mustache, beard };
}

function createBeardShapeGeometry() {
  const shape = new Shape();
  shape.moveTo(-0.28, -0.02);
  shape.bezierCurveTo(-0.34, -0.14, -0.3, -0.33, -0.16, -0.43);
  shape.bezierCurveTo(-0.08, -0.49, 0.08, -0.49, 0.16, -0.43);
  shape.bezierCurveTo(0.3, -0.33, 0.34, -0.14, 0.28, -0.02);
  shape.bezierCurveTo(0.2, -0.08, 0.1, -0.1, 0, -0.1);
  shape.bezierCurveTo(-0.1, -0.1, -0.2, -0.08, -0.28, -0.02);
  const geometry = new ShapeGeometry(shape, 32);
  geometry.computeVertexNormals();
  return geometry;
}

function createCheek(material: Material) {
  const cheek = new Mesh(new CircleGeometry(0.072, 32), material);
  cheek.scale.set(1.55, 0.68, 1);
  return cheek;
}

function createBackdrop(scene: Scene, accentMaterial: MeshStandardMaterial) {
  const lineMaterial = accentMaterial.clone();
  lineMaterial.transparent = true;
  lineMaterial.opacity = 0.18;
  lineMaterial.emissiveIntensity = 0.08;

  for (let index = 0; index < 5; index += 1) {
    const rail = new Mesh(new BoxGeometry(3.4, 0.01, 0.012), lineMaterial);
    rail.position.set(index % 2 ? 1.25 : -1.25, -1.05 - index * 0.24, -2.35 - index * 0.26);
    rail.rotation.x = -Math.PI / 2.8;
    scene.add(rail);
  }

  const leftPanel = new Mesh(new BoxGeometry(0.02, 1.6, 1.1), lineMaterial);
  leftPanel.position.set(-3.25, 0.8, -3.4);
  leftPanel.rotation.y = -0.22;
  scene.add(leftPanel);
  const rightPanel = leftPanel.clone();
  rightPanel.position.x = 3.25;
  rightPanel.rotation.y = 0.22;
  scene.add(rightPanel);
}

function isHairPartVisible(name: string, hairStyle: HairStyle) {
  if (hairStyle === "none") return false;
  if (name === "hair-cap") return true;
  if (name === "hair-short") return hairStyle === "short";
  if (name === "hair-bun") return hairStyle === "bun";
  if (name === "hair-side") return hairStyle === "soft" || hairStyle === "bun";
  if (name === "hair-soft") return hairStyle === "soft";
  return true;
}

function resizeScene(container: HTMLDivElement | null, handles: AvatarSceneHandles) {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(420, rect.height);
  handles.renderer.setSize(width, height);
  handles.camera.aspect = width / height;
  const mobile = width < 720;
  handles.camera.position.z = mobile ? 9.2 : width < 980 ? 7.1 : 6.35;
  handles.root.scale.setScalar(mobile ? 0.74 : 0.96);
  handles.root.position.y = mobile ? 0.62 : -0.04;
  handles.premiumBaseScale = mobile ? 0.72 : width < 980 ? 0.86 : 1;
  handles.premiumAvatar.scale.setScalar(handles.premiumBaseScale);
  handles.premiumAvatar.position.y = mobile ? 0.5 : 0.28;
  handles.camera.updateProjectionMatrix();
}

async function ensureFaceLandmarker(
  faceLandmarkerRef: React.MutableRefObject<FaceLandmarker | null>,
  promiseRef: React.MutableRefObject<Promise<FaceLandmarker | null> | null>
) {
  if (faceLandmarkerRef.current) return faceLandmarkerRef.current;
  if (!promiseRef.current) {
    promiseRef.current = createFaceLandmarker().then((faceLandmarker) => {
      faceLandmarkerRef.current = faceLandmarker;
      return faceLandmarker;
    });
  }

  return promiseRef.current;
}

async function createFaceLandmarker() {
  try {
    const vision = await FilesetResolver.forVisionTasks(mediaPipeVisionWasmUrl);
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: mediaPipeFaceLandmarkerUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.45,
      minFacePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  } catch {
    try {
      const vision = await FilesetResolver.forVisionTasks(mediaPipeVisionWasmUrl);
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: mediaPipeFaceLandmarkerUrl,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch {
      return null;
    }
  }
}

function animateAvatar(handles: AvatarSceneHandles, tracking: TrackingState, config: AvatarConfig) {
  const time = performance.now() / 1000;
  const analyser = analyserRefGlobal();
  const audioData = audioDataRefGlobal();
  let voice = 0;
  if (analyser && audioData) {
    analyser.getByteFrequencyData(audioData);
    voice = audioData.reduce((sum, item) => sum + item, 0) / (audioData.length * 255);
  }
  const mouthTarget = Math.min(1, Math.max(tracking.mouth, voice * 5.6 * config.voiceSensitivity));
  tracking.energy = lerp(tracking.energy, Math.max(voice, tracking.energy * 0.94), 0.08);
  const headAmp = 0.35 + config.headSensitivity * 1.15;
  const voiceAmp = 0.18 + config.voiceSensitivity * 0.35;
  const idleYaw = Math.sin(time * 0.42) * 0.018 * config.headSensitivity;
  const idlePitch = Math.sin(time * 0.53 + 0.8) * 0.012 * config.headSensitivity;
  const voiceIdle = (Math.sin(time * 2.6) + 1) * 0.006 * config.voiceSensitivity;

  handles.head.rotation.y = lerp(handles.head.rotation.y, tracking.yaw * headAmp + idleYaw, 0.14);
  handles.head.rotation.x = lerp(handles.head.rotation.x, tracking.pitch * (0.58 + config.headSensitivity * 0.38) + idlePitch, 0.12);
  handles.head.rotation.z = lerp(handles.head.rotation.z, tracking.roll * (0.5 + config.headSensitivity * 0.32) + Math.sin(time * 0.8) * 0.018, 0.1);
  handles.head.position.x = lerp(handles.head.position.x, tracking.yaw * (0.06 + config.headSensitivity * 0.05), 0.1);
  handles.root.rotation.y = lerp(handles.root.rotation.y, tracking.yaw * 0.16, 0.05);
  handles.premiumAvatar.rotation.y = lerp(handles.premiumAvatar.rotation.y, tracking.yaw * headAmp + idleYaw, 0.13);
  handles.premiumAvatar.rotation.x = lerp(
    handles.premiumAvatar.rotation.x,
    tracking.pitch * (0.35 + config.headSensitivity * 0.42) + idlePitch,
    0.11
  );
  handles.premiumAvatar.rotation.z = lerp(
    handles.premiumAvatar.rotation.z,
    tracking.roll * (0.32 + config.headSensitivity * 0.35) + Math.sin(time * 0.72) * 0.008 * config.headSensitivity,
    0.1
  );
  handles.premiumAvatar.position.x = lerp(handles.premiumAvatar.position.x, tracking.yaw * (0.16 + config.headSensitivity * 0.18), 0.1);
  const premiumBaseY = handles.premiumBaseScale < 0.8 ? 0.5 : 0.28;
  handles.premiumAvatar.position.y = lerp(
    handles.premiumAvatar.position.y,
    premiumBaseY + Math.sin(time * 1.1) * 0.018 * config.headSensitivity + tracking.energy * (0.08 + config.voiceSensitivity * 0.12),
    0.08
  );
  const premiumScale = handles.premiumBaseScale * (1 + Math.min(0.045, mouthTarget * voiceAmp * 0.08 + voiceIdle));
  handles.premiumAvatar.scale.setScalar(lerp(handles.premiumAvatar.scale.x, premiumScale, 0.1));
  handles.body.position.y = -1.08 + Math.sin(time * 1.5) * 0.016 + tracking.energy * 0.025;
  handles.body.rotation.z = lerp(handles.body.rotation.z, -tracking.roll * 0.12 + Math.sin(time * 0.75) * 0.012, 0.08);
  handles.body.rotation.y = lerp(handles.body.rotation.y, -tracking.yaw * 0.08, 0.06);
  const mouthBaseWidth = Number(handles.mouth.userData.baseWidth ?? 1);
  handles.mouth.scale.x = lerp(handles.mouth.scale.x, mouthBaseWidth * (0.8 + mouthTarget * 1.45), 0.26);
  handles.mouth.scale.y = lerp(handles.mouth.scale.y, 0.58 + mouthTarget * 0.26, 0.18);
  const browOffset = tracking.brow * 0.075 - tracking.mouth * 0.012;
  handles.leftBrow.position.y = lerp(handles.leftBrow.position.y, Number(handles.leftBrow.userData.baseY ?? 0.29) + browOffset, 0.16);
  handles.rightBrow.position.y = lerp(handles.rightBrow.position.y, Number(handles.rightBrow.userData.baseY ?? 0.29) + browOffset, 0.16);

  const autoBlink = Math.sin(time * 2.4) > 0.986 ? 0.12 : 1;
  const leftEyeBaseScale = Number(handles.leftEye.userData.baseScale ?? 1);
  const rightEyeBaseScale = Number(handles.rightEye.userData.baseScale ?? 1);
  const leftBlink = Math.min(autoBlink, clamp(1 - tracking.blinkLeft * 0.92, 0.1, 1));
  const rightBlink = Math.min(autoBlink, clamp(1 - tracking.blinkRight * 0.92, 0.1, 1));
  handles.leftEye.scale.y = lerp(handles.leftEye.scale.y, leftEyeBaseScale * leftBlink, 0.48);
  handles.rightEye.scale.y = lerp(handles.rightEye.scale.y, rightEyeBaseScale * rightBlink, 0.48);

  handles.renderer.render(handles.scene, handles.camera);
}

function applyMediaPipeResultToTracking(result: FaceLandmarkerResult, trackingRef: React.MutableRefObject<TrackingState>, sensitivity: number) {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks?.length) return false;

  const blends = result.faceBlendshapes[0]?.categories ?? [];
  const blend = (name: string) => getBlendshapeScore(blends, name);
  const poseFromMatrix = estimatePoseFromMatrix(result.facialTransformationMatrixes[0]);
  const poseFromLandmarks = estimatePoseFromLandmarks(landmarks);
  const mouthOpenFromLandmarks = estimateMouthOpenFromLandmarks(landmarks);
  const current = trackingRef.current;

  const jawOpen = blend("jawOpen");
  const mouthFunnel = blend("mouthFunnel");
  const mouthPucker = blend("mouthPucker");
  const smile = Math.max(blend("mouthSmileLeft"), blend("mouthSmileRight"));
  const brow = Math.max(blend("browInnerUp"), blend("browOuterUpLeft"), blend("browOuterUpRight"));
  const mouthTarget = clamp(Math.max(jawOpen * 1.2, mouthOpenFromLandmarks, mouthFunnel * 0.78, mouthPucker * 0.52), 0.02, 1);
  const yaw = poseFromMatrix ? lerp(poseFromLandmarks.yaw, poseFromMatrix.yaw, 0.65) : poseFromLandmarks.yaw;
  const pitch = poseFromMatrix ? lerp(poseFromLandmarks.pitch, poseFromMatrix.pitch, 0.56) : poseFromLandmarks.pitch;
  const roll = poseFromMatrix ? lerp(poseFromLandmarks.roll, poseFromMatrix.roll, 0.5) : poseFromLandmarks.roll;

  current.yaw = lerp(current.yaw, clamp(yaw * sensitivity, -0.82, 0.82), 0.34);
  current.pitch = lerp(current.pitch, clamp(pitch * sensitivity, -0.55, 0.55), 0.3);
  current.roll = lerp(current.roll, clamp(roll * sensitivity, -0.42, 0.42), 0.3);
  current.mouth = lerp(current.mouth, mouthTarget, 0.34);
  current.blinkLeft = lerp(current.blinkLeft, clamp(blend("eyeBlinkLeft") + blend("eyeSquintLeft") * 0.35, 0, 1), 0.42);
  current.blinkRight = lerp(current.blinkRight, clamp(blend("eyeBlinkRight") + blend("eyeSquintRight") * 0.35, 0, 1), 0.42);
  current.brow = lerp(current.brow, clamp(brow, 0, 1), 0.22);
  current.smile = lerp(current.smile, clamp(smile, 0, 1), 0.22);

  return true;
}

function getBlendshapeScore(categories: Category[], name: string) {
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}

function estimatePoseFromMatrix(matrix: Matrix | undefined) {
  if (!matrix?.data || matrix.data.length < 16) return null;

  const rotationMatrix = new Matrix4().fromArray(matrix.data);
  const euler = new Euler().setFromRotationMatrix(rotationMatrix, "XYZ");
  const yaw = clamp(-euler.y, -0.9, 0.9);
  const pitch = clamp(euler.x, -0.65, 0.65);
  const roll = clamp(-euler.z, -0.55, 0.55);

  if (![yaw, pitch, roll].every(Number.isFinite)) return null;
  return { yaw, pitch, roll };
}

function estimatePoseFromLandmarks(landmarks: NormalizedLandmark[]) {
  const leftEye = averageLandmarks(landmarks, [33, 133, 159, 145]);
  const rightEye = averageLandmarks(landmarks, [263, 362, 386, 374]);
  const leftCheek = landmarkAt(landmarks, 234);
  const rightCheek = landmarkAt(landmarks, 454);
  const nose = landmarkAt(landmarks, 1) ?? landmarkAt(landmarks, 4);
  const forehead = landmarkAt(landmarks, 10);
  const chin = landmarkAt(landmarks, 152);
  const eyeMid = averagePoints(leftEye, rightEye);
  const cheekMid = averagePoints(leftCheek, rightCheek);
  const faceHeight = forehead && chin ? Math.max(0.12, distance2d(forehead, chin)) : 0.35;
  const eyeWidth = leftEye && rightEye ? Math.max(0.08, distance2d(leftEye, rightEye)) : 0.24;
  const roll = leftEye && rightEye ? Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) : 0;
  const yaw = nose && cheekMid ? clamp((cheekMid.x - nose.x) / eyeWidth * 1.65, -0.82, 0.82) : 0;
  const pitch = nose && eyeMid ? clamp(((nose.y - eyeMid.y) / faceHeight - 0.24) * 2.25, -0.55, 0.55) : 0;

  return {
    yaw: clamp(yaw, -0.82, 0.82),
    pitch: clamp(pitch, -0.55, 0.55),
    roll: clamp(roll, -0.42, 0.42),
  };
}

function estimateMouthOpenFromLandmarks(landmarks: NormalizedLandmark[]) {
  const upperLip = landmarkAt(landmarks, 13);
  const lowerLip = landmarkAt(landmarks, 14);
  const leftMouth = landmarkAt(landmarks, 61);
  const rightMouth = landmarkAt(landmarks, 291);
  if (!upperLip || !lowerLip || !leftMouth || !rightMouth) return 0.04;

  const mouthWidth = Math.max(0.015, distance2d(leftMouth, rightMouth));
  return clamp((distance2d(upperLip, lowerLip) / mouthWidth - 0.04) * 2.9, 0.02, 1);
}

function landmarkAt(landmarks: NormalizedLandmark[], index: number) {
  return landmarks[index] ?? null;
}

function averageLandmarks(landmarks: NormalizedLandmark[], indexes: number[]) {
  const points = indexes.map((index) => landmarks[index]).filter(Boolean);
  if (!points.length) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
    visibility: 1,
  };
}

function averagePoints(left: NormalizedLandmark | null, right: NormalizedLandmark | null) {
  if (!left) return right;
  if (!right) return left;
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
    visibility: 1,
  };
}

function distance2d(left: NormalizedLandmark, right: NormalizedLandmark) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function sampleCameraFrame(
  video: HTMLVideoElement | null,
  trackingRef: React.MutableRefObject<TrackingState>,
  previousFrameRef: React.MutableRefObject<Uint8ClampedArray | null>,
  sensitivity: number,
  faceLandmarker: FaceLandmarker | null,
  lastVideoTimeRef: React.MutableRefObject<number>
): TrackingBackend | null {
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

  const mediaPipeReady = Boolean(faceLandmarker);
  if (faceLandmarker && video.currentTime !== lastVideoTimeRef.current) {
    lastVideoTimeRef.current = video.currentTime;
    try {
      const result = faceLandmarker.detectForVideo(video, performance.now());
      if (applyMediaPipeResultToTracking(result, trackingRef, sensitivity)) return "mediapipe";
    } catch {
      // The canvas fallback below keeps the local avatar usable if MediaPipe throws on a frame.
    }
  }

  const canvas = sampleCanvasRefGlobal();
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  let xTotal = 0;
  let yTotal = 0;
  let motion = 0;
  let motionTotal = 0;
  let motionXTotal = 0;
  let motionYTotal = 0;
  let skinTotal = 0;
  let skinXTotal = 0;
  let skinYTotal = 0;
  let skinMinX = canvas.width;
  let skinMaxX = 0;
  let skinMinY = canvas.height;
  let skinMaxY = 0;
  let leftSkin = 0;
  let rightSkin = 0;
  const previous = previousFrameRef.current;

  for (let index = 0; index < frame.length; index += 16) {
    const r = frame[index];
    const g = frame[index + 1];
    const b = frame[index + 2];
    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const pixelIndex = index / 4;
    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);
    const weight = Math.max(0, lum - 30);
    total += weight;
    xTotal += x * weight;
    yTotal += y * weight;
    const nx = x / canvas.width;
    const ny = y / canvas.height;
    const skinLike = isSkinPixel(r, g, b) && nx > 0.12 && nx < 0.88 && ny > 0.08 && ny < 0.86;
    if (skinLike) {
      const skinWeight = clamp(180 - Math.abs(lum - 132), 20, 180);
      skinTotal += skinWeight;
      skinXTotal += x * skinWeight;
      skinYTotal += y * skinWeight;
      skinMinX = Math.min(skinMinX, x);
      skinMaxX = Math.max(skinMaxX, x);
      skinMinY = Math.min(skinMinY, y);
      skinMaxY = Math.max(skinMaxY, y);
      if (nx < 0.5) leftSkin += skinWeight;
      else rightSkin += skinWeight;
    }

    if (previous) {
      const delta =
        Math.abs(frame[index] - previous[index]) + Math.abs(frame[index + 1] - previous[index + 1]) + Math.abs(frame[index + 2] - previous[index + 2]);
      motion += delta;
      if (delta > 18) {
        motionTotal += delta;
        motionXTotal += x * delta;
        motionYTotal += y * delta;
      }
    }
  }

  previousFrameRef.current = new Uint8ClampedArray(frame);
  if (total <= 0 && motionTotal <= 0) return null;

  const lightCx = total > 0 ? xTotal / total / canvas.width : 0.5;
  const lightCy = total > 0 ? yTotal / total / canvas.height : 0.52;
  const skinCx = skinTotal > 0 ? skinXTotal / skinTotal / canvas.width : lightCx;
  const skinCy = skinTotal > 0 ? skinYTotal / skinTotal / canvas.height : lightCy;
  const motionCx = motionTotal > 0 ? motionXTotal / motionTotal / canvas.width : lightCx;
  const motionCy = motionTotal > 0 ? motionYTotal / motionTotal / canvas.height : lightCy;
  const cxBase = skinTotal > 0 ? lerp(lightCx, skinCx, 0.72) : lightCx;
  const cyBase = skinTotal > 0 ? lerp(lightCy, skinCy, 0.64) : lightCy;
  const cx = motionTotal > 0 ? lerp(cxBase, motionCx, 0.44) : cxBase;
  const cy = motionTotal > 0 ? lerp(cyBase, motionCy, 0.36) : cyBase;
  const motionLevel = Math.min(1, motion / 240_000);
  const skinBalance = skinTotal > 0 ? (rightSkin - leftSkin) / skinTotal : 0;
  const faceWidth = skinTotal > 0 ? clamp((skinMaxX - skinMinX) / canvas.width, 0.18, 0.72) : 0.42;
  const faceHeight = skinTotal > 0 ? clamp((skinMaxY - skinMinY) / canvas.height, 0.2, 0.78) : 0.48;
  const faceSizePulse = clamp((0.46 - faceWidth) * 0.45 + (0.52 - faceHeight) * 0.22, -0.18, 0.18);
  const current = trackingRef.current;
  current.yaw = lerp(current.yaw, clamp((0.5 - cx) * sensitivity * 2.85 + skinBalance * sensitivity * 0.42, -0.74, 0.74), 0.26);
  current.pitch = lerp(current.pitch, clamp((cy - 0.52) * sensitivity * 1.75 + faceSizePulse * sensitivity, -0.48, 0.48), 0.24);
  current.roll = lerp(current.roll, clamp((0.5 - cx) * sensitivity * 0.86 + skinBalance * 0.24, -0.34, 0.34), 0.2);
  current.mouth = lerp(current.mouth, clamp(0.04 + motionLevel * 0.72, 0.02, 1), 0.16);
  current.blinkLeft = lerp(current.blinkLeft, 0, 0.18);
  current.blinkRight = lerp(current.blinkRight, 0, 0.18);
  current.brow = lerp(current.brow, 0, 0.16);
  current.smile = lerp(current.smile, 0, 0.16);

  return mediaPipeReady ? "mediapipe" : "fallback";
}

function makeSceneBackground(background: MeetingBackground) {
  if (background === "office") return new Color("#0E1511");
  if (background === "dark") return new Color("#090712");
  return new Color("#071016");
}

function buildAvatarVideoPrompt(script: string, motion: string) {
  return [
    "Создай AI-видео с говорящим аватаром по загруженному портретному фото.",
    `Сценарий: ${script}`,
    motion.trim() ? `Подача: ${motion.trim()}` : "",
  ].filter(Boolean).join("\n");
}

function dataUrlToReferenceImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Фото должно быть в формате JPG, PNG или WebP.");
  }

  return {
    dataBase64: match[2],
    mimeType: match[1].toLowerCase() as "image/jpeg" | "image/png" | "image/webp",
    filename: `nomduchat-avatar-reference.${imageExtension(match[1])}`,
  };
}

async function imageUrlToReferenceImage(imageUrl: string, filename: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Не удалось загрузить выбранный референс.");
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Референс должен быть изображением.");
  }

  return {
    ...dataUrlToReferenceImage(await blobToDataUrl(blob)),
    filename,
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(blob);
  });
}

function imageExtension(mimeType: string) {
  if (mimeType.toLowerCase() === "image/png") return "png";
  if (mimeType.toLowerCase() === "image/webp") return "webp";
  return "jpg";
}

function avatarRenderStatusLabel(status: MediaGenerationJobApiRecord["status"]) {
  if (status === "queued") return "В очереди";
  if (status === "running") return "Генерация";
  if (status === "succeeded") return "Готово";
  if (status === "cancelled") return "Остановлено";
  if (status === "refunded") return "Кредиты возвращены";
  return "Ошибка";
}

function upsertExpressionRender(
  current: AvatarExpressionRender[],
  expressionId: AvatarExpressionId,
  patch: Partial<AvatarExpressionRender>
) {
  const existing = current.find((item) => item.expressionId === expressionId);
  if (existing) {
    return current.map((item) => item.expressionId === expressionId ? { ...item, ...patch, expressionId } : item);
  }

  return [...current, { expressionId, ...patch }];
}

function buildAvatarImagePrompt(
  preset: AvatarReferencePreset,
  config: AvatarConfig,
  sourceMode: "identity" | "style",
  brief: string
) {
  const source = sourceMode === "identity"
    ? "The first uploaded image is the identity reference. Preserve the person's recognizable facial features, face shape, hairstyle direction, glasses if present, age, and natural personality. The second image is a visual-style reference only; never copy that person's identity."
    : "The uploaded image is a visual-style reference only. Create a new original person and never copy the reference identity.";
  const cleanBrief = brief.trim();

  return [
    "Create a beautiful premium AI avatar for nomduchat.",
    source,
    `Visual target: ${preset.promptNotes}.`,
    "Composition: clean square 1:1 portrait, head and shoulders, face large in frame, direct eye contact, elegant clothing, controlled studio background.",
    "Quality bar: polished profile avatar, coherent facial geometry, natural expression, intentional lighting, clean silhouette, no distorted hands or duplicated features.",
    cleanBrief ? `User direction: ${cleanBrief}.` : "",
    `Local avatar settings: skin ${config.skin}, hair ${config.hair}, outfit ${config.outfit}, accent ${config.accent}, face ${faceShapeLabels[config.faceShape]}, eyes ${eyeStyleLabels[config.eyeStyle]}, brows ${browStyleLabels[config.browStyle]}, glasses ${glassesStyleLabels[config.glassesStyle]}, hair style ${hairStyleLabels[config.hairStyle]}.`,
    "Output must be a clean reusable avatar image suitable for profile, chat assistant, onboarding, and later expression variants.",
    "No text, no logos, no watermark, no UI, no unchanged source photo, no busy background.",
  ].filter(Boolean).join("\n");
}

function buildAvatarExpressionPrompt(preset: AvatarReferencePreset, expression: AvatarExpressionPreset) {
  return [
    "Edit the provided avatar image into a new expression variant.",
    "Preserve the same character identity, face, hair, glasses, outfit, color palette, camera angle, selected visual style, and square portrait crop.",
    "Do not change gender, age, clothing, background family, or character proportions.",
    `Base reference style: ${preset.promptNotes}.`,
    `Requested expression: ${expression.prompt}.`,
    "No text, no logo, no watermark, no extra character.",
  ].join("\n");
}

async function blobToProfileAvatarDataUrl(blob: Blob) {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageFromUrl(sourceUrl);
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable.");
    context.fillStyle = "#050505";
    context.fillRect(0, 0, size, size);
    drawImageCover(context, image, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function readStoredConfig(): AvatarConfig {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultConfig;
    const stored = JSON.parse(raw) as Partial<AvatarConfig>;
    const sculpt = { ...defaultSculpt, ...stored.sculpt };
    return {
      ...defaultConfig,
      ...stored,
      glassesStyle: stored.glassesStyle ?? (sculpt.hasGlasses ? "round" : defaultConfig.glassesStyle),
      sculpt,
    };
  } catch {
    return defaultConfig;
  }
}

async function prepareAvatarPhoto(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(sourceUrl);
    const size = 900;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable.");
    context.fillStyle = "#0B1117";
    context.fillRect(0, 0, size, size);
    drawImageCover(context, image, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function extractPhotoProfile(photoDataUrl: string): Promise<Partial<AvatarConfig>> {
  const image = await loadImageFromUrl(photoDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return {};

  drawImageCover(context, image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const skin = averageCanvasRegion(context, 44, 45, 40, 32);
  const hair = averageCanvasRegion(context, 34, 10, 60, 24);
  const patch: Partial<AvatarConfig> = {};
  let skinTotal = 0;
  let skinX = 0;
  let skinY = 0;
  let skinMinX = canvas.width;
  let skinMaxX = 0;
  let skinMinY = canvas.height;
  let skinMaxY = 0;
  let upperSkinWidth = 0;
  let lowerSkinWidth = 0;
  let upperRows = 0;
  let lowerRows = 0;
  let darkEyeBand = 0;
  let darkEyeBandTotal = 0;
  let darkMouthBand = 0;
  let darkTop = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    let rowSkinMin = canvas.width;
    let rowSkinMax = 0;
    let rowHasSkin = false;

    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const nx = x / canvas.width;
      const ny = y / canvas.height;
      const central = nx > 0.15 && nx < 0.85 && ny > 0.08 && ny < 0.86;
      const skinLike = central && isSkinPixel(r, g, b);
      const eyeBand = nx > 0.2 && nx < 0.8 && ny > 0.32 && ny < 0.52;
      const mouthBand = nx > 0.28 && nx < 0.72 && ny > 0.58 && ny < 0.76;
      const topBand = nx > 0.18 && nx < 0.82 && ny > 0.05 && ny < 0.34;

      if (skinLike) {
        const weight = clamp(180 - Math.abs(lum - 132), 20, 180);
        skinTotal += weight;
        skinX += x * weight;
        skinY += y * weight;
        skinMinX = Math.min(skinMinX, x);
        skinMaxX = Math.max(skinMaxX, x);
        skinMinY = Math.min(skinMinY, y);
        skinMaxY = Math.max(skinMaxY, y);
        rowSkinMin = Math.min(rowSkinMin, x);
        rowSkinMax = Math.max(rowSkinMax, x);
        rowHasSkin = true;
      }
      if (eyeBand) {
        darkEyeBandTotal += 1;
        if (lum < 72 || (r < 96 && g < 96 && b < 96)) darkEyeBand += 1;
      }
      if (mouthBand && lum < 96) darkMouthBand += 1;
      if (topBand && lum < 95) darkTop += 1;
    }

    if (rowHasSkin) {
      const rowWidth = rowSkinMax - rowSkinMin;
      const ny = y / canvas.height;
      if (ny > 0.3 && ny < 0.5) {
        upperSkinWidth += rowWidth;
        upperRows += 1;
      }
      if (ny > 0.58 && ny < 0.78) {
        lowerSkinWidth += rowWidth;
        lowerRows += 1;
      }
    }
  }

  if (skin && skin.r > 42 && skin.g > 28 && skin.b > 22) {
    patch.skin = rgbToHex({
      r: clamp(skin.r * 1.04, 0, 255),
      g: clamp(skin.g * 1.02, 0, 255),
      b: clamp(skin.b * 0.98, 0, 255),
    });
  }
  if (hair && hair.r + hair.g + hair.b < 560) {
    patch.hair = rgbToHex({
      r: clamp(hair.r * 0.82, 0, 255),
      g: clamp(hair.g * 0.82, 0, 255),
      b: clamp(hair.b * 0.86, 0, 255),
    });
  }

  const faceWidth = skinTotal > 0 ? (skinMaxX - skinMinX) / canvas.width : 0.46;
  const faceLength = skinTotal > 0 ? (skinMaxY - skinMinY) / canvas.height : 0.58;
  const faceCy = skinTotal > 0 ? skinY / skinTotal / canvas.height : 0.52;
  const upperWidth = upperRows ? upperSkinWidth / upperRows / canvas.width : faceWidth;
  const lowerWidth = lowerRows ? lowerSkinWidth / lowerRows / canvas.width : faceWidth * 0.82;
  const darkEyeRatio = darkEyeBandTotal ? darkEyeBand / darkEyeBandTotal : 0;
  const hasGlasses = darkEyeRatio > 0.22;
  const faceRatio = faceLength / Math.max(0.22, faceWidth);
  const jawRatio = lowerWidth / Math.max(0.24, upperWidth);

  patch.sculpt = {
    faceWidth: clamp(faceWidth / 0.48, 0.84, 1.16),
    faceLength: clamp(faceLength / 0.58, 0.88, 1.18),
    jawWidth: clamp(lowerWidth / Math.max(0.24, upperWidth), 0.76, 1.16),
    eyeSpacing: clamp(0.96 + (faceWidth - 0.46) * 0.46, 0.88, 1.12),
    eyeSize: clamp(hasGlasses ? 0.94 : 1 + (0.5 - faceCy) * 0.16, 0.9, 1.08),
    browLift: clamp(0.98 + (0.5 - faceCy) * 0.28, 0.86, 1.14),
    noseWidth: clamp(0.94 + (faceWidth - 0.46) * 0.6, 0.84, 1.14),
    noseLength: clamp(1 + (faceLength - 0.58) * 0.34, 0.9, 1.16),
    mouthWidth: clamp(0.92 + darkMouthBand / 620, 0.86, 1.18),
    hasGlasses,
  };
  if (faceRatio > 1.34) {
    patch.faceShape = "long";
  } else if (jawRatio > 0.96) {
    patch.faceShape = "angular";
  } else if (faceRatio < 1.18 && faceWidth > 0.45) {
    patch.faceShape = "round";
  } else {
    patch.faceShape = "oval";
  }
  patch.glassesStyle = hasGlasses ? (darkEyeRatio > 0.3 ? "square" : "thin") : "none";
  patch.eyeStyle = hasGlasses ? "open" : faceCy > 0.54 ? "focused" : "calm";
  patch.browStyle = !hasGlasses && darkEyeRatio > 0.15 ? "thick" : "soft";

  if (darkTop > 840) {
    patch.hairStyle = "soft";
  } else if (darkTop > 420) {
    patch.hairStyle = "short";
  }

  return patch;
}

function loadImageFromUrl(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = source;
  });
}

function averageCanvasRegion(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): RgbColor | null {
  const data = context.getImageData(x, y, width, height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 24) continue;
    r += data[index];
    g += data[index + 1];
    b += data[index + 2];
    count += 1;
  }

  if (!count) return null;
  return { r: r / count, g: g / count, b: b / count };
}

function isSkinPixel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 52 && g > 34 && b > 24 && max - min > 12 && r > b * 1.08 && r > g * 0.88 && g > b * 0.78;
}

function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function mix(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sampleCanvasRefGlobal() {
  if (!globalSampleCanvas) {
    globalSampleCanvas = document.createElement("canvas");
    globalSampleCanvas.width = 96;
    globalSampleCanvas.height = 72;
  }
  return globalSampleCanvas;
}

let globalSampleCanvas: HTMLCanvasElement | null = null;
let globalAnalyser: AnalyserNode | null = null;
let globalAudioData: Uint8Array<ArrayBuffer> | null = null;

function analyserRefGlobal() {
  return globalAnalyser;
}

function audioDataRefGlobal() {
  return globalAudioData;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
