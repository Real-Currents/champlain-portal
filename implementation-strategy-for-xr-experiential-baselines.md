# Implementation Strategy for XR Experiential Baselines Step 2

The conversational spatial UI system for WebXR requires a carefully orchestrated pipeline integrating voice recognition, LLM orchestration via LangGraph, sentiment-responsive shaders, and real-time spatial generation—all while maintaining **90fps VR performance**. This implementation strategy provides the architecture, code patterns, and integration approach to build this system on your existing IWSDK foundation.

## Pipeline architecture overview

The complete conversation-to-spatial transformation flows through five synchronized layers: voice capture → semantic analysis → LangGraph orchestration → ECS entity generation → sentiment-responsive rendering. The critical insight is that **Chatterbox is TTS-only** (not speech-to-text), requiring Whisper or Web Speech API for voice input, while LangGraph.js provides the stateful workflow management needed to coordinate real-time VR interactions with comprehensive LangSmith tracing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VOICE INPUT LAYER                                   │
│  Web Speech API (desktop) ──┬── MediaRecorder → Whisper API (Quest/mobile)  │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LANGGRAPH ORCHESTRATION                                │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌────────────────────────┐  │
│  │Sentiment │──▶│Complexity │──▶│ Spatial  │──▶│ Tool Execution         │  │
│  │Analysis  │   │Estimation │   │ Template │   │ (geometry/shader/layout)│  │
│  └──────────┘   └───────────┘   └──────────┘   └────────────────────────┘  │
│       ↓ LangSmith Tracing (all nodes)                                       │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ECS WORLD (IWSDK)                                    │
│  Components: Transform, SentimentMaterial, ConceptNode, ConversationUI      │
│  Systems: SentimentShaderSystem, SpatialLayoutSystem, SubtitleSystem        │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBXR RENDER (Three.js @ 90fps)                           │
│  Sentiment-responsive ShaderMaterial │ troika-three-text subtitles          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Voice-based conversation system design

### Chatterbox integration for TTS response

Chatterbox from Resemble AI provides three model variants, with **ChatterboxTurboTTS** being optimal for VR due to its **350M parameter single-step decoder** designed for low-latency voice agents. The system requires server-side deployment since Chatterbox runs on CUDA GPUs, not in-browser.

```typescript
// Server endpoint for Chatterbox TTS (Python backend)
// POST /api/tts/generate
// Request: { text: string, voiceRef?: string, exaggeration?: number }
// Response: audio/wav stream

// Client-side integration
class ChatterboxTTSClient {
  private audioContext: AudioContext;
  private serverUrl: string;
  
  async synthesize(text: string, sentiment: SentimentDimensions): Promise<AudioBuffer> {
    // Map sentiment to Chatterbox exaggeration parameter
    const exaggeration = 0.5 + (sentiment.arousal * 0.5); // 0.25-1.0 range
    
    const response = await fetch(`${this.serverUrl}/api/tts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, exaggeration })
    });
    
    const audioData = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(audioData);
  }
}
```

### Speech-to-text strategy for WebXR

The **Oculus Quest browser does not support Web Speech API**, requiring a fallback architecture. The recommended pattern uses Web Speech API for desktop Chrome development with MediaRecorder → Whisper for Quest deployment.

```typescript
class VRSpeechRecognition {
  private recognition: SpeechRecognition | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private whisperEndpoint: string;
  
  constructor(whisperEndpoint: string) {
    this.whisperEndpoint = whisperEndpoint;
    this.initRecognition();
  }
  
  private initRecognition(): void {
    // Check for Web Speech API (desktop Chrome)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition && !this.isQuestBrowser()) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.setupWebSpeechHandlers();
    } else {
      this.setupWhisperFallback();
    }
  }
  
  private setupWhisperFallback(): void {
    navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true } 
    }).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      // Chunk-based streaming to Whisper for lower latency
    });
  }
  
  private isQuestBrowser(): boolean {
    return /OculusBrowser/i.test(navigator.userAgent);
  }
}
```

### VR subtitle system with troika-three-text

Spatial text positioning uses **head-locked with smooth lag** for real-time subtitles, positioning text **1.5m forward, 0.25m below eye level** with lerp-based following for reduced motion sickness.

```typescript
import { Text } from 'troika-three-text';

class VRSubtitleSystem {
  private subtitle: Text;
  private panel: THREE.Mesh;
  private targetPosition = new THREE.Vector3();
  private lagFactor = 0.08; // Smooth follow
  
  constructor(scene: THREE.Scene) {
    this.subtitle = new Text();
    this.subtitle.fontSize = 0.04;
    this.subtitle.color = 0xFFFFFF;
    this.subtitle.anchorX = 'center';
    this.subtitle.anchorY = 'middle';
    this.subtitle.maxWidth = 1.2;
    this.subtitle.outlineWidth = '8%';
    this.subtitle.outlineColor = 0x000000;
    
    // Semi-transparent background for readability
    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
    );
    this.panel.renderOrder = -1;
    
    scene.add(this.subtitle);
    scene.add(this.panel);
  }
  
  update(camera: THREE.Camera, deltaTime: number): void {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    this.targetPosition.copy(camera.position)
      .add(direction.multiplyScalar(1.5));
    this.targetPosition.y -= 0.25;
    
    // Smooth follow prevents jarring movement
    this.subtitle.position.lerp(this.targetPosition, this.lagFactor);
    this.panel.position.copy(this.subtitle.position);
    this.panel.position.z += 0.01;
    
    this.subtitle.lookAt(camera.position);
    this.panel.lookAt(camera.position);
  }
  
  showSpeaker(speaker: 'user' | 'assistant', text: string, isInterim: boolean = false): void {
    const prefix = speaker === 'user' ? '🎤 ' : '🤖 ';
    this.subtitle.text = prefix + text;
    this.subtitle.color = isInterim ? 0xCCCCCC : 0xFFFFFF;
    this.subtitle.sync();
  }
}
```

---

## LangGraph workflow for spatial UI generation

### State definition and workflow architecture

LangGraph.js provides stateful, multi-actor orchestration with **streaming support critical for VR responsiveness**. The workflow manages conversation context, sentiment analysis, spatial template selection, and tool execution for geometry/shader generation.

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { traceable } from "langsmith/traceable";
import { z } from "zod";

// Enable LangSmith tracing
process.env.LANGSMITH_TRACING = "true";
process.env.LANGSMITH_PROJECT = "xr-experiential-baselines";

// Comprehensive state definition
const VRConversationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  voiceTranscript: Annotation<string>(),
  sentiment: Annotation<SentimentDimensions>(),
  complexity: Annotation<number>(),
  engagement: Annotation<EngagementIndicators>(),
  spatialSpec: Annotation<SpatialUISpecification | null>(),
  shaderParams: Annotation<ShaderParameters>(),
  sessionMeta: Annotation<SessionMetadata>(),
});

interface SentimentDimensions {
  valence: number;    // -1 to +1 (negative → positive)
  arousal: number;    // -1 to +1 (calm → excited)
  dominance: number;  // -1 to +1 (submissive → in-control)
  confidence: number;
}

interface SpatialUISpecification {
  entities: EntityDefinition[];
  layout: 'radial' | 'tree' | 'timeline' | 'grid' | 'orbital';
  animations: AnimationDefinition[];
  culturalAdaptation?: CulturalProfile;
}
```

### Tool definitions for spatial generation

LangGraph tools enable the LLM to orchestrate Three.js operations through structured function calls with Zod schema validation.

```typescript
const createSpatialElement = tool(
  async ({ elementType, semanticLabel, position, visualStyle }) => {
    return JSON.stringify({
      type: elementType,
      label: semanticLabel,
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
      visual: visualStyle,
      timestamp: Date.now()
    });
  },
  {
    name: "create_spatial_element",
    description: "Create a 3D UI element representing a concept in the VR space",
    schema: z.object({
      elementType: z.enum(['concept_node', 'relationship_edge', 'info_panel', 'annotation']),
      semanticLabel: z.string().describe("The concept or text this element represents"),
      position: z.tuple([z.number(), z.number(), z.number()]),
      visualStyle: z.object({
        color: z.string().optional(),
        size: z.number().optional(),
        shape: z.enum(['sphere', 'box', 'cylinder', 'plane']).optional()
      })
    })
  }
);

const configureAdaptiveShader = tool(
  async ({ sentimentMapping, complexityLevel, animationParams }) => {
    return JSON.stringify({
      uniforms: {
        u_valence: { value: sentimentMapping.valence },
        u_arousal: { value: sentimentMapping.arousal },
        u_dominance: { value: sentimentMapping.dominance },
        u_complexity: { value: complexityLevel },
        u_animSpeed: { value: 1 + sentimentMapping.arousal * 3 }
      }
    });
  },
  {
    name: "configure_adaptive_shader",
    description: "Configure shader parameters based on conversation sentiment and complexity",
    schema: z.object({
      sentimentMapping: z.object({
        valence: z.number().min(-1).max(1),
        arousal: z.number().min(-1).max(1),
        dominance: z.number().min(-1).max(1)
      }),
      complexityLevel: z.number().min(0).max(1),
      animationParams: z.object({
        pulseEnabled: z.boolean(),
        waveIntensity: z.number()
      }).optional()
    })
  }
);

const arrangeSpatialLayout = tool(
  async ({ layoutType, elements, anchorPoint }) => {
    const layouts = {
      radial: (els: string[]) => els.map((_, i) => {
        const angle = (i / els.length) * Math.PI * 2;
        return [Math.cos(angle) * 1.5, 1.5, Math.sin(angle) * 1.5 - 2];
      }),
      tree: (els: string[]) => els.map((_, i) => [
        (i % 3 - 1) * 0.8,
        2 - Math.floor(i / 3) * 0.6,
        -2
      ]),
      timeline: (els: string[]) => els.map((_, i) => [
        -1.5 + (i * 0.5),
        1.5,
        -2
      ])
    };
    
    return JSON.stringify({
      layout: layoutType,
      positions: layouts[layoutType]?.(elements) || [],
      anchor: anchorPoint
    });
  },
  {
    name: "arrange_spatial_layout",
    description: "Arrange UI elements in 3D space using semantic layout patterns",
    schema: z.object({
      layoutType: z.enum(['radial', 'tree', 'timeline', 'grid', 'orbital']),
      elements: z.array(z.string()),
      anchorPoint: z.enum(['head', 'world', 'hand-left', 'hand-right'])
    })
  }
);
```

### Workflow node implementations

```typescript
// Sentiment analysis node with tiered approach
const analyzeSentiment = traceable(
  async (state: typeof VRConversationState.State) => {
    const text = state.voiceTranscript;
    
    // Fast lexicon-based first pass (sub-millisecond)
    const Sentiment = require('sentiment');
    const analyzer = new Sentiment();
    const quickResult = analyzer.analyze(text);
    
    // Convert to VAD dimensions
    const valence = Math.max(-1, Math.min(1, quickResult.comparative * 2));
    const confidence = Math.abs(quickResult.comparative);
    
    // LLM refinement for low-confidence or complex cases
    if (confidence < 0.3) {
      const model = new ChatOpenAI({ model: "gpt-4o-mini" });
      const response = await model.invoke([{
        role: "system",
        content: `Analyze sentiment dimensions. Return JSON: {"valence": -1 to 1, "arousal": -1 to 1, "dominance": -1 to 1}`
      }, {
        role: "user",
        content: text
      }]);
      
      const refined = JSON.parse(response.content as string);
      return { 
        sentiment: { ...refined, confidence: 0.8 } 
      };
    }
    
    return {
      sentiment: {
        valence,
        arousal: quickResult.tokens.length > 10 ? 0.3 : -0.1,
        dominance: quickResult.positive.length > quickResult.negative.length ? 0.2 : -0.2,
        confidence
      }
    };
  },
  { name: "analyze_sentiment", tags: ["vr", "sentiment"] }
);

// Complexity estimation node
const estimateComplexity = traceable(
  async (state: typeof VRConversationState.State) => {
    const text = state.voiceTranscript;
    
    // Compute readability metrics
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    
    // Normalize to 0-1 complexity score
    const complexity = Math.min(1, (
      (avgWordLength - 3) / 5 * 0.3 +
      (avgSentenceLength - 5) / 20 * 0.3 +
      (words.length - 5) / 50 * 0.4
    ));
    
    return { complexity: Math.max(0, complexity) };
  },
  { name: "estimate_complexity" }
);

// Spatial template generation node
const generateSpatialTemplate = traceable(
  async (state: typeof VRConversationState.State) => {
    const model = new ChatOpenAI({ 
      model: "gpt-4o-mini",
      temperature: 0.7 
    }).bindTools([createSpatialElement, configureAdaptiveShader, arrangeSpatialLayout]);
    
    const systemPrompt = `You are a spatial UI designer for VR educational experiences.
Given conversation context and sentiment, generate appropriate 3D spatial visualizations.
Use tools to create elements, configure shaders based on sentiment, and arrange layouts.

Current sentiment: valence=${state.sentiment.valence}, arousal=${state.sentiment.arousal}
Complexity: ${state.complexity}

Guidelines:
- Positive sentiment → warm colors, expansive layouts
- High arousal → animated, dynamic elements
- High complexity → hierarchical tree layouts with more nodes
- Low complexity → simple radial or linear layouts`;

    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: state.voiceTranscript }
    ]);
    
    // Extract tool calls and build spatial spec
    const toolCalls = response.tool_calls || [];
    const entities = toolCalls
      .filter(tc => tc.name === 'create_spatial_element')
      .map(tc => JSON.parse(tc.args));
    
    return {
      spatialSpec: {
        entities,
        layout: 'radial',
        animations: []
      }
    };
  },
  { name: "generate_spatial_template" }
);

// Map to shader parameters
const mapToShaderParams = traceable(
  async (state: typeof VRConversationState.State) => {
    const { sentiment, complexity } = state;
    
    return {
      shaderParams: {
        // Valence → color temperature (blue=negative, warm=positive)
        primaryHue: 220 - (sentiment.valence + 1) * 80, // 220 (blue) to 60 (yellow)
        saturation: 0.3 + Math.abs(sentiment.valence) * 0.5,
        brightness: 0.5 + sentiment.valence * 0.3,
        
        // Arousal → animation dynamics
        animationSpeed: 0.5 + (sentiment.arousal + 1) * 0.75,
        pulseIntensity: (sentiment.arousal + 1) / 2,
        displacementStrength: Math.max(0, sentiment.arousal) * 0.15,
        
        // Complexity → fractal detail
        fractalOctaves: Math.floor(2 + complexity * 6),
        noiseScale: 1 + complexity * 3,
        
        // Dominance → emission/presence
        emissionIntensity: (sentiment.dominance + 1) * 0.4
      }
    };
  },
  { name: "map_to_shader_params" }
);

// Build complete workflow
const vrConversationWorkflow = new StateGraph(VRConversationState)
  .addNode("sentiment", analyzeSentiment)
  .addNode("complexity", estimateComplexity)
  .addNode("spatial", generateSpatialTemplate)
  .addNode("shader", mapToShaderParams)
  .addEdge(START, "sentiment")
  .addEdge("sentiment", "complexity")
  .addEdge("complexity", "spatial")
  .addEdge("spatial", "shader")
  .addEdge("shader", END);

const checkpointer = new MemorySaver();
export const vrPipeline = vrConversationWorkflow.compile({ checkpointer });
```

---

## LangSmith tracing for educational effectiveness

### Tracing configuration and custom metrics

LangSmith provides observability into every node execution, enabling measurement of educational effectiveness through custom feedback scores.

```typescript
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";

const langsmithClient = new Client();

// Custom educational effectiveness metrics
interface EducationalMetrics {
  engagementScore: number;        // 0-1 based on interaction patterns
  comprehensionIndicator: number; // Inferred from clarification requests
  spatialClarity: number;         // How well spatial UI represents concepts
  emotionalResonance: number;     // Sentiment alignment with content
  sessionDuration: number;        // Time in VR session
  interactionCount: number;       // Voice commands processed
}

async function logEducationalMetrics(
  runId: string,
  metrics: EducationalMetrics
): Promise<void> {
  // Log each metric as feedback
  await langsmithClient.createFeedback(runId, "engagement", {
    score: metrics.engagementScore,
    comment: `Session engagement: ${(metrics.engagementScore * 100).toFixed(1)}%`
  });
  
  await langsmithClient.createFeedback(runId, "comprehension", {
    score: metrics.comprehensionIndicator,
    comment: `Comprehension level: ${metrics.comprehensionIndicator.toFixed(2)}`
  });
  
  await langsmithClient.createFeedback(runId, "spatial_clarity", {
    score: metrics.spatialClarity,
    comment: `Spatial UI effectiveness: ${metrics.spatialClarity.toFixed(2)}`
  });
  
  await langsmithClient.createFeedback(runId, "emotional_resonance", {
    score: metrics.emotionalResonance,
    comment: `Emotional alignment: ${metrics.emotionalResonance.toFixed(2)}`
  });
}

// Track engagement throughout VR session
class EducationalSessionTracker {
  private interactionHistory: Array<{
    timestamp: number;
    sentiment: SentimentDimensions;
    responseLatency: number;
  }> = [];
  
  private clarificationCount = 0;
  private positiveAcknowledgments = 0;
  
  trackInteraction(sentiment: SentimentDimensions, latency: number): void {
    this.interactionHistory.push({
      timestamp: Date.now(),
      sentiment,
      responseLatency: latency
    });
  }
  
  trackClarification(): void {
    this.clarificationCount++;
  }
  
  trackAcknowledgment(): void {
    this.positiveAcknowledgments++;
  }
  
  calculateMetrics(): EducationalMetrics {
    const interactions = this.interactionHistory;
    const duration = interactions.length > 1 
      ? interactions[interactions.length - 1].timestamp - interactions[0].timestamp 
      : 0;
    
    // Engagement: frequent interactions with positive sentiment trend
    const avgValence = interactions.reduce((sum, i) => sum + i.sentiment.valence, 0) / interactions.length;
    const engagementScore = Math.min(1, (interactions.length / 20) * 0.5 + (avgValence + 1) / 4);
    
    // Comprehension: inverse of clarification ratio
    const clarificationRatio = this.clarificationCount / Math.max(interactions.length, 1);
    const comprehensionIndicator = Math.max(0, 1 - clarificationRatio * 2);
    
    return {
      engagementScore,
      comprehensionIndicator,
      spatialClarity: 0.8, // Would be measured from user gaze patterns
      emotionalResonance: (avgValence + 1) / 2,
      sessionDuration: duration / 1000,
      interactionCount: interactions.length
    };
  }
}
```

---

## Adaptive shader system implementation

### Sentiment-responsive ShaderMaterial

The shader system uses **VAD (Valence-Arousal-Dominance)** mapping to visual parameters, with smooth interpolation for natural transitions. Performance target: uniform updates at **30fps** while rendering at **90fps**.

```typescript
// SentimentShaderMaterial.ts
import * as THREE from 'three';

export class SentimentShaderMaterial extends THREE.ShaderMaterial {
  private targetParams: ShaderParameters;
  private currentParams: ShaderParameters;
  private interpolationSpeed = 0.1;
  
  constructor() {
    super({
      uniforms: {
        u_time: { value: 0 },
        u_valence: { value: 0 },
        u_arousal: { value: 0 },
        u_dominance: { value: 0 },
        u_complexity: { value: 0.5 },
        u_primaryHue: { value: 0.5 },
        u_saturation: { value: 0.5 },
        u_emissionIntensity: { value: 0.3 },
        u_animSpeed: { value: 1.0 },
        u_displacementStrength: { value: 0.0 }
      },
      vertexShader: SENTIMENT_VERTEX_SHADER,
      fragmentShader: SENTIMENT_FRAGMENT_SHADER,
      transparent: true
    });
    
    this.targetParams = this.getDefaultParams();
    this.currentParams = { ...this.targetParams };
  }
  
  updateSentiment(params: Partial<ShaderParameters>): void {
    this.targetParams = { ...this.targetParams, ...params };
  }
  
  // Call at 30fps for smooth interpolation
  tick(time: number): void {
    this.uniforms.u_time.value = time;
    
    // Lerp current → target
    this.currentParams.primaryHue += (this.targetParams.primaryHue - this.currentParams.primaryHue) * this.interpolationSpeed;
    this.currentParams.saturation += (this.targetParams.saturation - this.currentParams.saturation) * this.interpolationSpeed;
    this.currentParams.emissionIntensity += (this.targetParams.emissionIntensity - this.currentParams.emissionIntensity) * this.interpolationSpeed;
    
    // Update uniforms
    this.uniforms.u_primaryHue.value = this.currentParams.primaryHue / 360;
    this.uniforms.u_saturation.value = this.currentParams.saturation;
    this.uniforms.u_emissionIntensity.value = this.currentParams.emissionIntensity;
    this.uniforms.u_animSpeed.value = this.currentParams.animationSpeed;
  }
}

const SENTIMENT_VERTEX_SHADER = `
precision highp float;

uniform float u_time;
uniform float u_arousal;
uniform float u_displacementStrength;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normal;
  
  // Arousal-driven vertex displacement
  float displacement = 0.0;
  displacement += sin(position.x * 5.0 + u_time * 2.0) * 0.5;
  displacement += sin(position.y * 8.0 + u_time * 3.0) * 0.3;
  displacement *= u_displacementStrength;
  
  vec3 newPosition = position + normal * displacement;
  vPosition = newPosition;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const SENTIMENT_FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform float u_valence;
uniform float u_arousal;
uniform float u_dominance;
uniform float u_complexity;
uniform float u_primaryHue;
uniform float u_saturation;
uniform float u_emissionIntensity;
uniform float u_animSpeed;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Simplex noise (simplified)
float noise(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
}

// Fractal brownian motion for complexity
float fbm(vec3 pos, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * noise(pos * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

void main() {
  float time = u_time * u_animSpeed;
  
  // Complexity-driven fractal detail
  int octaves = int(2.0 + u_complexity * 6.0);
  float noiseValue = fbm(vPosition * 2.0 + time * 0.1, octaves);
  
  // Base color from hue (valence already mapped to hue externally)
  float hue = u_primaryHue + noiseValue * 0.05;
  float sat = u_saturation + noiseValue * 0.1 * u_arousal;
  float val = 0.6 + u_dominance * 0.2;
  
  vec3 baseColor = hsv2rgb(vec3(hue, sat, val));
  
  // Arousal-driven pulsing
  float pulse = 1.0 + sin(time * 4.0) * 0.1 * max(0.0, u_arousal);
  
  // Emission glow
  vec3 emission = baseColor * u_emissionIntensity * (1.0 + sin(time * 2.0) * 0.2);
  
  vec3 finalColor = baseColor * pulse + emission;
  
  gl_FragColor = vec4(finalColor, 0.9);
}
`;
```

### ECS integration with IWSDK

```typescript
// SentimentMaterialComponent.ts
import { defineComponent, Types } from '@meta-quest/iwsdk';

export const SentimentMaterial = defineComponent({
  valence: Types.f32,
  arousal: Types.f32,
  dominance: Types.f32,
  complexity: Types.f32,
  lastUpdateTime: Types.f32
});

// SentimentShaderSystem.ts
import { createSystem } from '@meta-quest/iwsdk';

export class SentimentShaderSystem extends createSystem({
  sentimentEntities: { required: [SentimentMaterial, Transform] }
}) {
  private materialInstances: Map<number, SentimentShaderMaterial> = new Map();
  private lastShaderUpdate = 0;
  private shaderUpdateInterval = 33; // 30fps shader updates
  
  execute(delta: number, time: number): void {
    // Only update shaders at 30fps to preserve frame budget
    if (time - this.lastShaderUpdate < this.shaderUpdateInterval) return;
    this.lastShaderUpdate = time;
    
    for (const entity of this.queries.sentimentEntities.entities) {
      const sentiment = entity.get(SentimentMaterial);
      const material = this.materialInstances.get(entity.index);
      
      if (material) {
        material.updateSentiment({
          primaryHue: 220 - (sentiment.valence + 1) * 80,
          saturation: 0.3 + Math.abs(sentiment.valence) * 0.5,
          emissionIntensity: (sentiment.dominance + 1) * 0.4,
          animationSpeed: 0.5 + (sentiment.arousal + 1) * 0.75
        });
        material.tick(time);
      }
    }
  }
}
```

---

## Performance optimization strategies

### Frame budget allocation for 90fps VR

With an **11.1ms frame budget** at 90fps, careful allocation prevents dropped frames:

| Operation | Budget | Strategy |
|-----------|--------|----------|
| Voice/NLP processing | 0ms (worker thread) | Web Worker isolation |
| LangGraph workflow | 0ms (async) | Background processing, stream results |
| Shader uniform updates | 0.5ms | 30fps staggered updates |
| ECS system execution | 2-3ms | Efficient queries, batched updates |
| Three.js rendering | 5-6ms | Draw call budget: <100 |
| Buffer margin | 2-3ms | Safety for GC, spikes |

### Implementation patterns

```typescript
// Web Worker for sentiment analysis (keeps main thread free)
// sentiment-worker.ts
const Sentiment = require('sentiment');
const analyzer = new Sentiment();

self.onmessage = (e: MessageEvent) => {
  const { text, id } = e.data;
  const result = analyzer.analyze(text);
  
  self.postMessage({
    id,
    sentiment: {
      valence: Math.max(-1, Math.min(1, result.comparative * 2)),
      confidence: Math.abs(result.comparative)
    }
  });
};

// Main thread usage
class SentimentWorkerPool {
  private worker: Worker;
  private pendingRequests: Map<string, (result: any) => void> = new Map();
  
  constructor() {
    this.worker = new Worker('./sentiment-worker.ts');
    this.worker.onmessage = (e) => {
      const { id, sentiment } = e.data;
      this.pendingRequests.get(id)?.(sentiment);
      this.pendingRequests.delete(id);
    };
  }
  
  analyze(text: string): Promise<SentimentDimensions> {
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, resolve);
      this.worker.postMessage({ text, id });
    });
  }
}

// Object pooling for geometry
class GeometryPool {
  private spherePool: THREE.SphereGeometry[] = [];
  private boxPool: THREE.BoxGeometry[] = [];
  
  getSphere(): THREE.SphereGeometry {
    return this.spherePool.pop() || new THREE.SphereGeometry(0.1, 16, 16);
  }
  
  returnSphere(geom: THREE.SphereGeometry): void {
    this.spherePool.push(geom);
  }
}

// Render loop with staggered updates
class VRRenderLoop {
  private lastSentimentUpdate = 0;
  private sentimentUpdateInterval = 33; // 30fps
  
  animate = (time: number): void => {
    // Always render at 90fps
    this.renderer.render(this.scene, this.camera);
    
    // Stagger expensive updates
    if (time - this.lastSentimentUpdate > this.sentimentUpdateInterval) {
      this.sentimentShaderSystem.execute(time);
      this.lastSentimentUpdate = time;
    }
    
    // Always update subtitles (cheap operation)
    this.subtitleSystem.update(this.camera, time);
  };
}
```

---

## Complete integration example

### Main application bootstrapping

```typescript
// main.ts - XR Experiential Baselines Step 2
import { IWSDKBootstrap } from './iwsdk/IWSDKBootstrap';
import { EnhancedControllerManager } from './iwsdk/EnhancedControllerManager';
import { VRSpeechRecognition } from './voice/VRSpeechRecognition';
import { VRSubtitleSystem } from './ui/VRSubtitleSystem';
import { vrPipeline } from './langgraph/vrConversationWorkflow';
import { SentimentShaderSystem } from './shaders/SentimentShaderSystem';
import { EducationalSessionTracker } from './analytics/EducationalSessionTracker';
import { ChatterboxTTSClient } from './voice/ChatterboxTTSClient';

class XRExperientialApp {
  private iwsdk: IWSDKBootstrap;
  private speechRecognition: VRSpeechRecognition;
  private subtitleSystem: VRSubtitleSystem;
  private sentimentSystem: SentimentShaderSystem;
  private sessionTracker: EducationalSessionTracker;
  private ttsClient: ChatterboxTTSClient;
  
  async initialize(): Promise<void> {
    // Initialize IWSDK foundation (from Step 1)
    this.iwsdk = new IWSDKBootstrap();
    await this.iwsdk.initialize();
    
    // Voice systems
    this.speechRecognition = new VRSpeechRecognition('/api/whisper/transcribe');
    this.ttsClient = new ChatterboxTTSClient('/api/tts');
    
    // UI systems
    this.subtitleSystem = new VRSubtitleSystem(this.iwsdk.scene);
    
    // Shader systems
    this.sentimentSystem = new SentimentShaderSystem(this.iwsdk.world);
    
    // Analytics
    this.sessionTracker = new EducationalSessionTracker();
    
    // Wire up voice → pipeline → spatial UI
    this.speechRecognition.onTranscript = this.handleVoiceInput.bind(this);
  }
  
  private async handleVoiceInput(transcript: string, isFinal: boolean): Promise<void> {
    // Show user speech immediately
    this.subtitleSystem.showSpeaker('user', transcript, !isFinal);
    
    if (!isFinal) return;
    
    const startTime = performance.now();
    
    // Stream through LangGraph pipeline
    const sessionId = this.iwsdk.sessionId;
    const config = { configurable: { thread_id: sessionId } };
    
    for await (const event of vrPipeline.stream(
      { voiceTranscript: transcript },
      { ...config, streamMode: ['updates'] }
    )) {
      // Immediately apply sentiment to shaders
      if (event.sentiment) {
        this.sentimentSystem.updateGlobal(event.sentiment);
        this.sessionTracker.trackInteraction(event.sentiment, performance.now() - startTime);
      }
      
      // Generate spatial UI from spec
      if (event.spatialSpec) {
        this.generateSpatialUI(event.spatialSpec);
      }
      
      // Update shader parameters
      if (event.shaderParams) {
        this.sentimentSystem.updateParameters(event.shaderParams);
      }
    }
    
    // Generate TTS response
    const state = await vrPipeline.getState(config);
    const assistantResponse = this.generateAssistantResponse(state);
    
    this.subtitleSystem.showSpeaker('assistant', assistantResponse);
    const audio = await this.ttsClient.synthesize(assistantResponse, state.sentiment);
    this.playAudio(audio);
  }
  
  private generateSpatialUI(spec: SpatialUISpecification): void {
    for (const entityDef of spec.entities) {
      const entity = this.iwsdk.world.createTransformEntity();
      
      // Add sentiment-responsive material
      entity.add(SentimentMaterial, {
        valence: 0,
        arousal: 0,
        dominance: 0,
        complexity: 0.5
      });
      
      // Create Three.js visual
      const geometry = this.createGeometry(entityDef.visual?.shape || 'sphere');
      const material = new SentimentShaderMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(...entityDef.transform.position);
      this.iwsdk.scene.add(mesh);
      
      // Animate entrance
      this.animateEntrance(mesh);
    }
  }
  
  private animateEntrance(mesh: THREE.Mesh): void {
    mesh.scale.set(0, 0, 0);
    
    new Tween({ scale: 0 })
      .to({ scale: 1 }, 400)
      .easing(Easing.Elastic.Out)
      .onUpdate(({ scale }) => {
        mesh.scale.set(scale, scale, scale);
      })
      .start();
  }
}

// Bootstrap application
const app = new XRExperientialApp();
app.initialize().then(() => {
  console.log('XR Experiential Baselines Step 2 initialized');
});
```

---

## Key implementation recommendations

The conversational spatial UI system succeeds when **voice latency stays under 1 second** for transcription, **shader updates remain invisible** through smooth 30fps interpolation, and **LangSmith tracing captures every interaction** for educational effectiveness measurement.

**Critical path optimizations:**
- Deploy Whisper on edge infrastructure (Cloudflare Workers AI or similar) for sub-500ms transcription
- Pre-warm LLM connections at session start to eliminate cold-start latency
- Use `MemorySaver` checkpointer during development, migrate to Redis for production session persistence
- Implement progressive spatial UI generation—show simple placeholder geometry immediately, refine as LLM completes

**Sentiment-shader calibration:**
- Test VAD mappings with diverse educational content to validate emotional resonance
- Consider cultural palette overrides for international deployment
- Log shader parameter histograms in LangSmith to identify parameter ranges that correlate with high engagement

This architecture provides the foundation for natural voice conversations that generate contextually appropriate 3D spatial UI with emotionally responsive materials, while comprehensive tracing enables continuous improvement of educational effectiveness.