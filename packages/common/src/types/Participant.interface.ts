export type ParticipantType = 'user' | 'external';

export interface Participant {
  id: string;
  name: string;
  type: ParticipantType;
}
