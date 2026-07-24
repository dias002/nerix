import type { ChatAttachmentInput, MediaGenerationJobApiRecord } from "../../api";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  attachments?: AttachedFile[];
  generationJob?: MediaGenerationJobApiRecord;
  imageReferenceJob?: MediaGenerationJobApiRecord;
  selectedBest?: boolean;
}

export type AttachedFile = ChatAttachmentInput & {
  id: string;
};
