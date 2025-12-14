// Initialize transformers.js environment before any imports
import { env } from '@xenova/transformers';

// Disable local models
env.allowLocalModels = false;

// Enable remote models from HuggingFace
env.allowRemoteModels = true;
env.remoteHost = 'https://huggingface.co';
env.remotePathTemplate = '{model}/resolve/{revision}/';

// Use browser cache
env.useBrowserCache = true;

// Configure ONNX to use WASM backend with single thread
env.backends = {
  onnx: {
    wasm: {
      numThreads: 1,
      wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/',
    }
  }
};

export { env };
