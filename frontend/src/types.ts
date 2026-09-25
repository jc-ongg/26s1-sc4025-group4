export type User = { id: string; name: string; email: string };
export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  area: string;
  description: string;
  price: string;
  artwork: string;
  slots: Slot[];
  active: boolean;
  address: string;
  latitude: number | null;
  longitude: number | null;
  imagePath?: string;
  sourceUrl?: string;
  tags: string[];
  signatureDishes: string[];
};
export type Slot = {
  id: string;
  startsAt: string;
  minimumPartySize: number;
  capacity: number;
  discount: number;
  allocation?: { groupId: string | null; bookingId: string | null } | null;
  restaurant: Restaurant;
};
export type Group = {
  id: string;
  title: string;
  description: string;
  hostId: string;
  host: { id: string; name: string };
  capacity: number;
  status: "OPEN" | "FULL" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  slot: Slot;
  members: { userId: string; user: { id: string; name: string } }[];
  booking: Booking | null;
};
export type Booking = {
  id: string;
  userId: string;
  partySize: number;
  status: "CONFIRMED" | "CANCELLED";
  slot: Slot;
  group: { id: string; title: string; hostId: string } | null;
};
