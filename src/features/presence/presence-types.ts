export interface CollaboratorPresence {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  view: "board" | "calendar";
  activeLane?: string | null;
  role: "owner" | "editor" | "viewer";
  lastActiveAt: number;
}

export interface PresencePingPayload {
  view: "board" | "calendar";
  activeLane?: string | null;
  isEditing?: boolean;
}

export interface PresenceResponse {
  collaborators: CollaboratorPresence[];
}
