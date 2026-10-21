export interface MemberModel {
  id: string;
  name: string;
  email: string;
  userID?: string; // Optional, für Zuordnung zum echten User
}
