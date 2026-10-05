import { randomUUID } from "node:crypto";
import { getDb } from "../../database/db";
import { NotFoundError } from "../../shared/errors";
import { toAddressDto, type AddressDto, type AddressRow } from "./addresses.types";

const TABLE = "addresses";

export interface AddressInput {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export async function listOwnAddresses(customerId: string): Promise<AddressDto[]> {
  const rows = await getDb()<AddressRow>(TABLE)
    .where({ customer_id: customerId })
    .orderBy([{ column: "is_default", order: "desc" }, { column: "created_at", order: "desc" }]);
  return rows.map(toAddressDto);
}

/**
 * Resolves the Cognito `sub` that owns an `addresses.id` row — used by
 * `requireOwnership()` on `/customer/addresses/:id` routes. Joins through
 * `customers` since the address table only stores the internal customer id.
 */
export async function getAddressOwnerSub(addressId: string): Promise<string | null> {
  const row = await getDb()<AddressRow>(TABLE)
    .join("customers", "customers.id", "addresses.customer_id")
    .where("addresses.id", addressId)
    .first<{ cognito_sub: string } | undefined>("customers.cognito_sub as cognito_sub");
  return row ? row.cognito_sub : null;
}

export async function getOwnAddressById(customerId: string, addressId: string): Promise<AddressDto> {
  const row = await getDb()<AddressRow>(TABLE).where({ id: addressId, customer_id: customerId }).first();
  if (!row) throw new NotFoundError("Address not found.");
  return toAddressDto(row);
}

/**
 * Marking an address as default unsets any other default address for the
 * same customer inside the same transaction, so a customer can never end up
 * with more than one default address.
 */
export async function createOwnAddress(customerId: string, input: AddressInput): Promise<AddressDto> {
  const id = randomUUID();
  await getDb().transaction(async (trx) => {
    if (input.isDefault) {
      await trx<AddressRow>(TABLE).where({ customer_id: customerId }).update({ is_default: false });
    }
    await trx<AddressRow>(TABLE).insert({
      id,
      customer_id: customerId,
      label: input.label,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      is_default: Boolean(input.isDefault),
    });
  });
  return getOwnAddressById(customerId, id);
}

export async function updateOwnAddress(
  customerId: string,
  addressId: string,
  patch: Partial<AddressInput>
): Promise<AddressDto> {
  const existing = await getDb()<AddressRow>(TABLE).where({ id: addressId, customer_id: customerId }).first();
  if (!existing) throw new NotFoundError("Address not found.");

  await getDb().transaction(async (trx) => {
    if (patch.isDefault) {
      await trx<AddressRow>(TABLE).where({ customer_id: customerId }).update({ is_default: false });
    }
    const dbPatch: Partial<AddressRow> = {};
    if (patch.label !== undefined) dbPatch.label = patch.label;
    if (patch.line1 !== undefined) dbPatch.line1 = patch.line1;
    if (patch.line2 !== undefined) dbPatch.line2 = patch.line2 ?? null;
    if (patch.city !== undefined) dbPatch.city = patch.city;
    if (patch.state !== undefined) dbPatch.state = patch.state;
    if (patch.pincode !== undefined) dbPatch.pincode = patch.pincode;
    if (patch.isDefault !== undefined) dbPatch.is_default = patch.isDefault;
    if (Object.keys(dbPatch).length > 0) {
      await trx<AddressRow>(TABLE).where({ id: addressId, customer_id: customerId }).update(dbPatch);
    }
  });

  return getOwnAddressById(customerId, addressId);
}

export async function deleteOwnAddress(customerId: string, addressId: string): Promise<void> {
  const deleted = await getDb()<AddressRow>(TABLE).where({ id: addressId, customer_id: customerId }).delete();
  if (!deleted) throw new NotFoundError("Address not found.");
}
