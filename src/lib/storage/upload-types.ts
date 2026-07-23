import type { AllowedImageContentType } from "@/lib/storage/image-limits";

/** Client + server shared upload protocol types. */
export type UploadSlotRequest = {
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
};

export type UploadSlot = UploadSlotRequest & {
  objectKey: string;
  uploadUrl: string;
};

export type ConfirmImageInput = UploadSlotRequest & {
  objectKey: string;
};

export type UploadedImageDto = {
  id: string;
  publicUrl: string;
  sortOrder: number;
  width: number;
  height: number;
  contentType: string;
};

export type PromotedImage = {
  objectKey: string;
  contentType: AllowedImageContentType;
  byteSize: number;
  width: number;
  height: number;
  finalKey: string;
  publicUrl: string;
};
