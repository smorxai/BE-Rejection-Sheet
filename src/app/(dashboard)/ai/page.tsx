"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertTriangle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DefectType, Line } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const EXAMPLE_QUESTIONS = [
  "Which line had the highest rejection cost this month?",
  "What is the overall rejection rate trend over the last 3 months?",
  "Which defect type occurs most frequently?",
  "Compare rejection rates between all production lines.",
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [rcDefect, setRcDefect] = useState("");
  const [rcLine, setRcLine] = useState("all");
  const [rcLoading, setRcLoading] = useState(false);
  const [rcResult, setRcResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/defect-types").then((r) => r.json()),
      fetch("/api/lines").then((r) => r.json()),
    ]).then(([d, l]) => { setDefectTypes(d); setLines(l); });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question?: string) => {
    const q = question ?? input.trim();
    if (!q) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: q, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      setAiAvailable(json.available);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: json.available
          ? json.answer ?? "No response generated."
          : "AI insights are unavailable — OPENAI_API_KEY is not configured.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "An error occurred. Please try again.", timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runRootCause = async () => {
    if (!rcDefect) return;
    setRcLoading(true);
    setRcResult(null);
    try {
      const res = await fetch("/api/ai/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defectTypeId: rcDefect,
          lineId: rcLine !== "all" ? rcLine : undefined,
          spikeDate: new Date().toISOString().split("T")[0],
        }),
      });
      const json = await res.json();
      setRcResult(json.available ? json.analysis : "AI unavailable — OPENAI_API_KEY not set.");
    } finally {
      setRcLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Chat */}
      <Card className="flex flex-col h-[500px]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <CardTitle>Natural Language Query</CardTitle>
          </div>
          <CardDescription>
            Ask questions about your rejection data in plain English.{" "}
            <Badge variant="warning" className="text-xs">AI Generated — verify before acting</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Try asking:</p>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left text-sm bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-4 py-2 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="bg-blue-600 rounded-full p-1.5 h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="bg-gray-300 rounded-full p-1.5 h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-700" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="bg-blue-600 rounded-full p-1.5 h-8 w-8 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about your rejection data..."
              disabled={loading}
            />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Root Cause Analysis */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <CardTitle>Root Cause Analysis</CardTitle>
          </div>
          <CardDescription>
            Select a defect type to get AI-powered root cause suggestions based on historical patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={rcDefect} onValueChange={setRcDefect}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select defect type..." />
              </SelectTrigger>
              <SelectContent>
                {defectTypes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rcLine} onValueChange={setRcLine}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lines</SelectItem>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runRootCause} disabled={!rcDefect || rcLoading}>
              {rcLoading ? "Analyzing..." : "Analyze Root Cause"}
            </Button>
          </div>

          {rcResult && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">AI Root Cause Analysis</span>
                <Badge variant="warning" className="text-xs">Verify with production team</Badge>
              </div>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{rcResult}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
