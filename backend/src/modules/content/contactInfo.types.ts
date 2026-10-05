export const CONTACT_INFO_SINGLETON_ID = "singleton";

export interface SocialLink {
  platform: string;
  url: string;
}

export interface ContactInfoRow {
  id: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string | null;
  hours: string | null;
  social_links: string; // JSON column — string with mysql2 unless typeCast configured
}

export interface ContactInfoDto {
  phone: string;
  whatsapp: string;
  email: string | null;
  address: string | null;
  hours: string | null;
  socialLinks: SocialLink[];
}

function parseSocialLinks(value: string): SocialLink[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toContactInfoDto(row: ContactInfoRow): ContactInfoDto {
  return {
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    hours: row.hours,
    socialLinks: parseSocialLinks(row.social_links),
  };
}
