export default function Stars({ rating, size = 14 }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star ${i <= Math.round(rating) ? '' : 'empty'}`} style={{ fontSize: size }}>
          ★
        </span>
      ))}
    </div>
  );
}
