import { requestUrl, Notice } from 'obsidian';

interface OllamaResponse {
    response: string;
    error?: string;
}

interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
}

interface OllamaModelsResponse {
    models: OllamaModel[];
}

interface OllamaVersionResponse {
    version: string;
}

interface OllamaChatResponse {
    message?: {
        content?: string;
    };
}

interface OllamaPullResponse {
    ok?: boolean;
    status?: number;
}

export class OllamaService {
    private retryAttempts = 3;
    private retryDelay = 1000; // ms
    private baseUrl: string;

    constructor(host: string = 'http://localhost:11434') {
        // Ensure the host has a protocol and normalize the URL
        if (!host.startsWith('http://') && !host.startsWith('https://')) {
            host = 'http://' + host;
        }
        // Remove trailing slash if present
        this.baseUrl = host.replace(/\/$/, '');
    }

    async listModels(): Promise<string[]> {
        try {
            await this.ensureConnection();

            const response = await this.makeRequest<OllamaModelsResponse>({
                endpoint: '/api/tags',
                method: 'GET'
            });

            if (!response || !response.models) {
                throw new Error('Invalid API response format');
            }

            return response.models.map((model: OllamaModel) => model.name);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async generateCompletion(model: string, prompt: string): Promise<string> {
        try {
            await this.ensureConnection();

            const response = await this.makeRequest<OllamaResponse>({
                endpoint: '/api/generate',
                method: 'POST',
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false
                })
            });

            if (!response || !response.response) {
                throw new Error('Invalid API response format');
            }

            return response.response;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async pullModel(modelName: string): Promise<void> {
        try {
            new Notice(`Downloading model ${modelName}...`);
            const response = await this.makeRequest<OllamaPullResponse>({
                endpoint: '/api/pull',
                method: 'POST',
                body: JSON.stringify({
                    name: modelName
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to download model: ${response.status}`);
            }

            new Notice(`Model ${modelName} downloaded successfully`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to download model: ${message}`);
        }
    }

    async chat(model: string, messages: { role: string, content: string }[]): Promise<string> {
        try {
            await this.ensureConnection();

            const response = await this.makeRequest<OllamaChatResponse>({
                endpoint: '/api/chat',
                method: 'POST',
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false
                })
            });

            if (!response || !response.message?.content) {
                throw new Error('Invalid API response format');
            }

            return response.message.content;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    private async ensureConnection(): Promise<void> {
        if (!this.baseUrl) {
            throw new Error('Ollama service not configured. Please set the host in settings.');
        }
        const isConnected = await this.testConnection();
        if (!isConnected) {
            throw new Error('Unable to connect to Ollama service. Please ensure the service is running.');
        }
    }

    async testConnection(): Promise<boolean> {
        if (!this.baseUrl) {
            return false;
        }
        
        try {
            const response = await this.makeRequest<OllamaVersionResponse>({
                endpoint: '/api/version',
                method: 'GET'
            });

            return !!response?.version;
        } catch {
            return false;
        }
    }

    private async makeRequest<T = unknown>(params: {
        endpoint: string;
        method: string;
        body?: string;
    }): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const url = new URL(params.endpoint, this.baseUrl).toString();
                
                const response = await requestUrl({
                    url,
                    method: params.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: params.body,
                    throw: false
                });

                if (response.status === 200) {
                    try {
                        // Some Ollama endpoints might return empty responses
                        if (!response.text) {
                            return {} as T;
                        }

                        // Try to parse as JSON
                        const jsonResponse = JSON.parse(response.text) as T;
                        return jsonResponse;
                    } catch {
                        throw new Error('Invalid JSON response from server');
                    }
                }

                // Handle non-200 responses
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorJson = JSON.parse(response.text) as { error?: string };
                    if (errorJson.error) {
                        errorMessage = errorJson.error;
                    }
                } catch {
                    // If we can't parse the error as JSON, use the raw text
                    if (response.text) {
                        errorMessage = response.text;
                    }
                }
                throw new Error(errorMessage);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
                break;
            }
        }

        throw lastError ?? new Error('Request failed');
    }

    private handleError(error: unknown): Error {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('ECONNREFUSED')) {
            new Notice('Ollama service is not running. Please start the service.');
            return new Error('Unable to connect to Ollama service. Please ensure the service is running.');
        }
        if (error instanceof TypeError && message.includes('Invalid URL')) {
            return new Error(`Invalid Ollama service URL: ${this.baseUrl}`);
        }
        return error instanceof Error ? error : new Error(message);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }
}
