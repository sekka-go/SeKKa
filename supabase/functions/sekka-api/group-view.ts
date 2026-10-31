export function activeMemberIdForRider(members, riderId) {
  if (!Number.isSafeInteger(riderId) || riderId < 1) return null;
  const member = members.find((candidate)=>candidate.status === "active" && candidate.rider_user_id === riderId);
  return member && Number.isSafeInteger(member.id) && member.id > 0 ? member.id : null;
}
