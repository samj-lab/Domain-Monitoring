export interface SerpApiResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
}

export interface SerpApiConfig {
  apiKey: string;
  engine: string;
  gl: string;
  hl: string;
  location: string;
  googleDomain: string;
  num: number;
  device: string;
}

export interface SerpApiResponse {
  search_metadata?: {
    status?: string;
    total_time_taken?: number;
  };
  search_information?: {
    total_results?: number;
    time_taken_displayed?: number;
  };
  organic_results?: Array<{
    position: number;
    title: string;
    link: string;
    snippet?: string;
  }>;
  error?: string;
}

interface SignalMessageData {
  timestamp?: number;
  message?: string;
  groupInfo?: {
    groupId?: string;
    groupName?: string;
    type?: string;
  };
}

export interface SignalWebhookEnvelope {
  account?: string;
  envelope?: {
    source?: string;
    sourceNumber?: string;
    sourceName?: string;
    sourceDevice?: number;
    timestamp?: number;
    /** Messages from other users */
    dataMessage?: SignalMessageData;
    /** Messages sent by this account (synced back from linked devices) */
    syncMessage?: {
      sentMessage?: SignalMessageData;
    };
    typingMessage?: unknown;
    receiptMessage?: unknown;
  };
}
