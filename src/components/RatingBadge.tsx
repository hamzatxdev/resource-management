export function ratingClass(r: number) {
  if (r >= 4.75) return "rating-5";
  if (r >= 3.75) return "rating-4";
  if (r >= 2.75) return "rating-3";
  if (r >= 1.75) return "rating-2";
  return "rating-1";
}

export function RatingBadge({
  rating,
  overridden,
}: {
  rating: number;
  overridden?: boolean;
}) {
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${ratingClass(rating)}`}
      title={overridden ? "User override" : "AI rating"}
    >
      {rating.toFixed(1)}
      {overridden && (
        <span className="ml-0.5 inline-block h-1 w-1 rounded-full bg-accent align-middle" />
      )}
    </span>
  );
}
