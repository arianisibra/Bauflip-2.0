"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type VoiceTextareaProps = {
  name?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionType;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function VoiceTextarea({
  name,
  id,
  placeholder,
  required,
  minLength,
  defaultValue = "",
  value,
  onValueChange,
}: VoiceTextareaProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const latestValueRef = useRef(defaultValue);
  const currentValue = value ?? internalValue;

  useEffect(() => {
    latestValueRef.current = currentValue;
  }, [currentValue]);

  const updateValue = (nextValue: string) => {
    latestValueRef.current = nextValue;
    if (onValueChange) {
      onValueChange(nextValue);
      return;
    }
    setInternalValue(nextValue);
  };

  const hasSpeechApi =
    typeof window !== "undefined" &&
    (Boolean(window.SpeechRecognition) || Boolean(window.webkitSpeechRecognition));

  const startListening = () => {
    if (!hasSpeechApi) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "de-CH";
      recognitionRef.current.onresult = (event) => {
        const latest = event.results[event.results.length - 1];
        const text = latest[0]?.transcript?.trim();
        if (!text) {
          return;
        }
        const combined = `${latestValueRef.current}${latestValueRef.current ? " " : ""}${text}`;
        updateValue(combined);
      };
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return (
    <div className="relative">
      <Textarea
        id={id}
        name={name}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        value={currentValue}
        onChange={(event) => updateValue(event.target.value)}
        className="pr-12"
      />
      <Button
        type="button"
        size="icon-sm"
        variant={isListening ? "secondary" : "outline"}
        className="absolute top-2 right-2 rounded-full"
        onClick={isListening ? stopListening : startListening}
        disabled={!hasSpeechApi}
        title={hasSpeechApi ? "Spracheingabe starten" : "Spracheingabe im Browser nicht verfügbar"}
      >
        {isListening ? <MicOff /> : <Mic />}
      </Button>
    </div>
  );
}
