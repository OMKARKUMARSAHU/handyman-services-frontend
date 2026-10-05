import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import {
  CONTACT_INFO_SINGLETON_ID,
  toContactInfoDto,
  type ContactInfoDto,
  type ContactInfoRow,
  type SocialLink,
} from "./contactInfo.types";

const TABLE = "contact_info";

export async function getContactInfo(): Promise<ContactInfoDto | null> {
  const row = await getDb()<ContactInfoRow>(TABLE).where({ id: CONTACT_INFO_SINGLETON_ID }).first();
  return row ? toContactInfoDto(row) : null;
}

export interface UpsertContactInfoInput {
  phone: string;
  whatsapp: string;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  socialLinks?: SocialLink[];
}

/** One row for the whole site (id = "singleton") — upserted, never multiple contact-info records. */
export async function upsertContactInfo(input: Partial<UpsertContactInfoInput>): Promise<ContactInfoDto> {
  const existing = await getDb()<ContactInfoRow>(TABLE).where({ id: CONTACT_INFO_SINGLETON_ID }).first();

  if (!existing) {
    if (!input.phone || !input.whatsapp) {
      throw new NotFoundError("Contact info has not been set up yet — phone and whatsapp are required on first save.");
    }
    await getDb()<ContactInfoRow>(TABLE).insert({
      id: CONTACT_INFO_SINGLETON_ID,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email ?? null,
      address: input.address ?? null,
      hours: input.hours ?? null,
      social_links: JSON.stringify(input.socialLinks ?? []),
    } as unknown as ContactInfoRow);
  } else {
    const patch: Partial<ContactInfoRow> = {};
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.whatsapp !== undefined) patch.whatsapp = input.whatsapp;
    if (input.email !== undefined) patch.email = input.email;
    if (input.address !== undefined) patch.address = input.address;
    if (input.hours !== undefined) patch.hours = input.hours;
    if (input.socialLinks !== undefined) patch.social_links = JSON.stringify(input.socialLinks) as unknown as string;
    if (Object.keys(patch).length > 0) {
      await getDb()<ContactInfoRow>(TABLE).where({ id: CONTACT_INFO_SINGLETON_ID }).update(patch);
    }
  }

  const row = await getDb()<ContactInfoRow>(TABLE).where({ id: CONTACT_INFO_SINGLETON_ID }).first();
  return toContactInfoDto(row!);
}
