export type Gender = "MALE" | "FEMALE";
export type User = {
  id: string;
  name: string;
  email: string;
  singpassVerified: boolean;
  age: number | null;
  gender: Gender | null;
};
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
  availableSeats?: number;
  eventIds?: string[];
  eatTogetherEnabled?: boolean;
  allocation?: { groupId: string | null; bookingId: string | null } | null;
  restaurant: Restaurant;
};
export type Group = {
  id: string;
  title: string;
  description: string;
  hostId: string;
  host: { id: string; name: string; age: number | null; gender: Gender | null };
  genderFilter: Gender | null;
  minAge: number | null;
  maxAge: number | null;
  capacity: number;
  status:
    | "OPEN"
    | "FULL"
    | "CONFIRMED"
    | "CANCELLED"
    | "EXPIRED"
    | "LAST_CALL"
    | "PRICE_DECISION"
    | "FULL_PRICE";
  cutoffAt?: string;
  heldSeats?: number;
  discount?: number;
  chatOpenedAt?: string | null;
  leavePenalty?: boolean;
  slot: Slot;
  members: {
    userId: string;
    partySize: number;
    priceAccepted?: boolean;
    user: { id: string; name: string; age: number | null; gender: Gender | null };
  }[];
  booking: Booking | null;
};
export type Booking = {
  id: string;
  userId: string;
  partySize: number;
  discount?: number | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  slot: Slot;
  group: { id: string; title: string; hostId: string } | null;
};

export type PersonalBooking = Booking & { yourPartySize: number | null };
