export type StoredFile = {
  name: string;
  type: string;
  key: string;
  url: string;
};

export type UploadFile = {
  buffer: Buffer;
  name: string;
  type: string;
};
