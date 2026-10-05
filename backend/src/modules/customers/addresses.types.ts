export interface AddressDto {
  id: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface AddressRow {
  id: string;
  customer_id: string | null;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean | number;
}

export function toAddressDto(row: AddressRow): AddressDto {
  return {
    id: row.id,
    customerId: row.customer_id as string,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    isDefault: Boolean(row.is_default),
  };
}
