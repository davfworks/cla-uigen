import { anthropic } from "@ai-sdk/anthropic";
import {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2Message,
} from "@ai-sdk/provider";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(messages: LanguageModelV2Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const content = message.content;
        if (Array.isArray(content)) {
          const textParts = content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text);
          return textParts.join(" ");
        }
      }
    }
    return "";
  }

  private countToolResults(messages: LanguageModelV2Message[]): number {
    let count = 0;
    for (const message of messages) {
      if (message.role === "tool") count++;
    }
    return count;
  }

  private async *generateMockStream(
    messages: LanguageModelV2Message[],
    userPrompt: string
  ): AsyncGenerator<LanguageModelV2StreamPart> {
    const toolMessageCount = this.countToolResults(messages);

    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("card") || promptLower.includes("pricing")) {
      componentType = "card";
      componentName = "Card";
    }

    yield { type: "stream-start", warnings: [] };

    // Step 3: Create App.jsx first (toolMessageCount === 0)
    if (toolMessageCount === 0) {
      const text = `This is a static response. You can place an Anthropic API key in the .env file to use the Anthropic API for component generation. Let me create an App.jsx file to display the component.`;
      yield { type: "text-start", id: "t1" };
      for (const char of text) {
        yield { type: "text-delta", id: "t1", delta: char };
        await this.delay(15);
      }
      yield { type: "text-end", id: "t1" };

      yield {
        type: "tool-call",
        toolCallId: "call_3",
        toolName: "str_replace_editor",
        input: JSON.stringify({
          command: "create",
          path: "/App.jsx",
          file_text: this.getAppCode(componentName),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
      };
      return;
    }

    // Step 1: Create component file
    if (toolMessageCount === 1) {
      const text = `I'll create a ${componentName} component for you.`;
      yield { type: "text-start", id: "t1" };
      for (const char of text) {
        yield { type: "text-delta", id: "t1", delta: char };
        await this.delay(25);
      }
      yield { type: "text-end", id: "t1" };

      yield {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "str_replace_editor",
        input: JSON.stringify({
          command: "create",
          path: `/components/${componentName}.jsx`,
          file_text: this.getComponentCode(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
      };
      return;
    }

    // Step 2: Enhance component
    if (toolMessageCount === 2) {
      const text = `Now let me enhance the component with better styling.`;
      yield { type: "text-start", id: "t1" };
      for (const char of text) {
        yield { type: "text-delta", id: "t1", delta: char };
        await this.delay(25);
      }
      yield { type: "text-end", id: "t1" };

      yield {
        type: "tool-call",
        toolCallId: "call_2",
        toolName: "str_replace_editor",
        input: JSON.stringify({
          command: "str_replace",
          path: `/components/${componentName}.jsx`,
          old_str: this.getOldStringForReplace(componentType),
          new_str: this.getNewStringForReplace(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
      };
      return;
    }

    // Step 4: Final summary
    if (toolMessageCount >= 3) {
      const text = `Perfect! I've created:\n\n1. **${componentName}.jsx** - A fully-featured ${componentType} component\n2. **App.jsx** - The main app file that displays the component\n\nThe component is now ready to use. You can see the preview on the right side of the screen.`;
      yield { type: "text-start", id: "t1" };
      for (const char of text) {
        yield { type: "text-delta", id: "t1", delta: char };
        await this.delay(30);
      }
      yield { type: "text-end", id: "t1" };

      yield {
        type: "finish",
        finishReason: "stop",
        usage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
      };
      return;
    }
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thank you! We\\'ll get back to you soon.');
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Contact Us</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea name="message" value={formData.message} onChange={handleChange} required rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
          Send Message
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `import React from 'react';

const Card = ({
  title = "Pro Plan",
  price = "$29",
  period = "/month",
  features = ["Unlimited projects", "Priority support", "Advanced analytics", "Custom integrations"],
  highlighted = true,
}) => {
  return (
    <div className={\`relative rounded-2xl p-8 \${highlighted ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'bg-white text-gray-800 shadow-md'}\`}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
          Most Popular
        </div>
      )}
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-5xl font-extrabold">{price}</span>
        <span className={\`text-sm \${highlighted ? 'text-blue-200' : 'text-gray-400'}\`}>{period}</span>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={\`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 \${highlighted ? 'bg-blue-500' : 'bg-blue-100'}\`}>
              <svg className={\`w-3 h-3 \${highlighted ? 'text-white' : 'text-blue-600'}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            {f}
          </li>
        ))}
      </ul>
      <button className={\`w-full py-3 rounded-xl font-semibold transition-all \${highlighted ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}\`}>
        Get Started
      </button>
    </div>
  );
};

export default Card;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Counter</h2>
      <div className="text-4xl font-bold mb-6">{count}</div>
      <div className="flex gap-4">
        <button onClick={() => setCount(c => c - 1)} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Decrease</button>
        <button onClick={() => setCount(0)} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">Reset</button>
        <button onClick={() => setCount(c => c + 1)} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">Increase</button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form": return "    alert('Thank you! We\\'ll get back to you soon.');";
      case "card": return '      <div className="p-8">';
      default: return "  const increment = () => setCount(c => c + 1);";
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form": return "    alert('Thank you! We\\'ll get back to you soon.');\n    setFormData({ name: '', email: '', message: '' });";
      case "card": return '      <div className="p-8 hover:bg-gray-50 transition-colors">';
      default: return "  const increment = () => setCount(c => c + 1);\n  // Enhanced";
    }
  }

  private getAppCode(componentName: string): string {
    if (componentName === "Card") {
      return `import Card from '@/components/Card';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <Card />
      </div>
    </div>
  );
}`;
    }

    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <${componentName} />
      </div>
    </div>
  );
}`;
  }

  async doGenerate(
    options: Parameters<LanguageModelV2["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const parts: LanguageModelV2StreamPart[] = [];
    for await (const part of this.generateMockStream(options.prompt, userPrompt)) {
      parts.push(part);
    }

    const content: any[] = [];
    let currentText = "";
    for (const part of parts) {
      if (part.type === "text-delta") currentText += part.delta;
      if (part.type === "text-end" && currentText) {
        content.push({ type: "text", text: currentText });
        currentText = "";
      }
      if (part.type === "tool-call") {
        content.push({ type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName, input: part.input });
      }
    }

    const finishPart = parts.find((p) => p.type === "finish") as any;
    return {
      content,
      finishReason: finishPart?.finishReason ?? "stop",
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      warnings: [],
    };
  }

  async doStream(
    options: Parameters<LanguageModelV2["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        try {
          for await (const chunk of self.generateMockStream(options.prompt, userPrompt)) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return { stream, warnings: [] };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude-sonnet-4-0");
  }

  return anthropic(MODEL);
}
