"use client";
import Link from "next/link";
import React, { useState, useEffect } from "react";

const Page = () => {
  const [textPrompt, setTextPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch("/api/voices",{method:"GET"});
        if (!response.ok) throw new Error("Failed to fetch voices");
        const data = await response.json();

        // Assuming 'data' is an array of voice objects
        setVoices(data);

        // Set the first voice's voice_id as the default selected voice
        if (data.length > 0) setSelectedVoice(data[0].voice_id);
      } catch (err) {
        console.error("Error fetching voices:", err);
        setError("Failed to load voices");
      }
    };

    fetchVoices();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setAudioUrl("");

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ textPrompt, voiceId: selectedVoice }),
      });

      if (!response.ok) {
        throw new Error("Failed to convert text to speech");
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = "generated_speech.mp3";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <br />
      <Link href={"/"}>Back to homepage</Link>
      <br />
      <br />
      <Link href={"/download"} style={{ margin: "40px" }}>
        Tiktok Scraping
      </Link>
      <br />
      <br />
      <h1 className="text-2xl font-bold mb-4">Text-to-Speech Converter</h1>
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={textPrompt}
          style={{ color: "black" }}
          onChange={(e) => setTextPrompt(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-2"
          rows="4"
          placeholder="Enter text to convert to speech"
          required
        />
        <br />
        <br />
        <select
          value={selectedVoice}
          style={{ color: "black" }}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-2"
          required
        >
          {voices.length > 0 ? (
            voices.map((voice) => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {voice.name} - {voice.accent} ({voice.language}, {voice.gender},{" "}
                {voice.age})
              </option>
            ))
          ) : (
            <option value="">Loading voices...</option>
          )}
        </select>
        <br />
        <br />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          disabled={isLoading}
        >
          {isLoading ? "Converting..." : "Convert to Speech"}
        </button>
      </form>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {audioUrl && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Generated Audio:</h2>
          <div className="flex items-center space-x-4">
            <audio controls src={audioUrl} className="flex-grow">
              Your browser does not support the audio element.
            </audio>
            <button
              onClick={handleDownload}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Download MP3
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;
