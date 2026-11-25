import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook for Speech-to-Text (Voice Dictation)
 * Uses browser-native Web Speech API (window.SpeechRecognition || window.webkitSpeechRecognition)
 * 
 * Features:
 * - Cross-browser prefix handling & compatibility detection
 * - Continuous listening with automatic restart on silence timeouts
 * - Separation of interim (in-progress) and final speech transcripts
 * - Allows keyboard typing while mic is active without text duplication or erasure
 * - Safe lifecycle cleanup to prevent memory leaks or locked microphones
 */
export function useSpeechToText(options = {}) {
  const {
    lang = 'en-US',
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    onTranscriptChange,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [text, setText] = useState('');

  // Check browser support
  const isSupported = typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const baseTextRef = useRef(''); // Stores text before speech started
  const finalSpokenRef = useRef(''); // Accumulates finalized phrases

  // Initialize SpeechRecognition instance
  const initRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onresult = (event) => {
      let currentInterim = '';
      let newlyFinalized = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const transcriptPart = item[0]?.transcript || '';

        if (item.isFinal) {
          newlyFinalized += transcriptPart + ' ';
        } else {
          currentInterim += transcriptPart;
        }
      }

      if (newlyFinalized) {
        finalSpokenRef.current += newlyFinalized;
      }

      setInterimTranscript(currentInterim);

      // Compute total text = baseText + finalSpoken + interim
      const finalizedPortion = (finalSpokenRef.current).trim();
      const combinedSpoken = currentInterim
        ? (finalizedPortion ? `${finalizedPortion} ${currentInterim}` : currentInterim)
        : finalizedPortion;

      const base = baseTextRef.current.trim();
      const fullText = base
        ? (combinedSpoken ? `${base} ${combinedSpoken}` : base)
        : combinedSpoken;

      setText(fullText);
      if (onTranscriptChange) {
        onTranscriptChange(fullText);
      }
    };

    recognition.onerror = (event) => {
      // 'no-speech' is triggered when the user pauses. Do NOT kill the session!
      if (event.error === 'no-speech') {
        return;
      }

      const errorMessages = {
        'not-allowed': 'Microphone access was denied. Please allow microphone permissions in your browser.',
        'service-not-allowed': 'Speech recognition service is unavailable in your browser.',
        'audio-capture': 'No microphone detected on your system. Please plug in or enable a microphone.',
        'network': 'Network error reaching speech recognition service. Check your internet connection.',
        'aborted': '',
      };

      const errMsg = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
      if (errMsg) {
        setError(errMsg);
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setInterimTranscript('');
      // If the user did NOT explicitly stop listening, auto-restart to maintain continuous listening
      if (isListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch (e) {
          // In case start fails, mark stopped
          isListeningRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [isSupported, continuous, interimResults, lang, maxAlternatives, onTranscriptChange]);

  // Start listening
  const startListening = useCallback((currentInputText = '') => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    // Capture whatever is already typed as base
    baseTextRef.current = (typeof currentInputText === 'string' ? currentInputText : text).trim();
    finalSpokenRef.current = '';
    setInterimTranscript('');
    setError(null);
    isListeningRef.current = true;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = initRecognition();
      recognitionRef.current = recognition;
      if (recognition) {
        recognition.start();
      }
    } catch (err) {
      console.warn('Speech recognition start error:', err);
      setError('Could not start microphone. Please check permissions.');
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, text, initRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setInterimTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        try {
          recognitionRef.current.abort();
        } catch (err) {}
      }
      recognitionRef.current = null;
    }

    // Merge whatever was spoken into the text permanently
    const full = (baseTextRef.current + ' ' + finalSpokenRef.current).replace(/\s+/g, ' ').trim();
    if (full) {
      setText(full);
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback((currentInputText = '') => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening(currentInputText);
    }
  }, [startListening, stopListening]);

  // Update text when user edits manually with keyboard
  const updateText = useCallback((newText) => {
    setText(newText);
    baseTextRef.current = newText;
    finalSpokenRef.current = '';
  }, []);

  // Clear text
  const clearText = useCallback(() => {
    setText('');
    baseTextRef.current = '';
    finalSpokenRef.current = '';
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    text,
    startListening,
    stopListening,
    toggleListening,
    updateText,
    clearText,
    setText,
  };
}

export default useSpeechToText;

