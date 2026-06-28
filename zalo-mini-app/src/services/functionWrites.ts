import { callFunction, getFunctionWriteMode, isFirebaseConfigured } from "./firebase";

export async function callFunctionOrFallback<TInput, TOutput>(
  name: string,
  payload: TInput,
  fallback: () => Promise<TOutput>,
): Promise<TOutput> {
  const mode = getFunctionWriteMode();

  if (mode === "direct") {
    return fallback();
  }

  if (!isFirebaseConfigured() && mode !== "required") {
    return fallback();
  }

  try {
    return await callFunction<TInput, TOutput>(name, payload);
  } catch (error) {
    if (mode === "required") {
      throw error;
    }

    console.warn(`Cloud Function ${name} lỗi, dùng fallback để test nội bộ.`, error);
    return fallback();
  }
}

export async function callWriteFunctionOrFallback<TInput, TOutput>(
  name: string,
  payload: TInput,
  fallback: () => Promise<TOutput>,
): Promise<TOutput> {
  return callFunctionOrFallback(name, payload, fallback);
}
