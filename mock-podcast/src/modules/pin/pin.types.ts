export type PinRecord = {
  /**
   * Normalised profile id — the storage key.
   *
   * This is the profile whose PIN the record holds, not the profile of
   * whoever is asking: a master profile manages a child profile's PIN by
   * sending that child's id.
   *
   * An empty string is the app-wide PIN — apps that gate everything behind a
   * single code send no profile at all, and that record is theirs.
   */
  profile: string;
  pinCode: string;
  updatedAt: string;
};

export type PinEventData = {
  /** Whose PIN this operation targets. The client sends a number. */
  profile?: string | number;
  pin_code?: string;
  current_pin_code?: string;
  step?: string;
  /**
   * Why a PIN is being verified. `manage` marks the verify that authorises
   * parental actions, so entering a profile cannot be mistaken for it.
   */
  purpose?: string;
};

export type PinAck = {
  specversion: string;
  type: string;
  source: string;
  subject: string;
  id: string;
  time: string;
};
