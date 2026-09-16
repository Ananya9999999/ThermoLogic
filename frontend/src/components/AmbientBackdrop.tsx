/** Slow-moving abstract pastel shapes — sits behind the whole app. */
import "./AmbientBackdrop.css";

export default function AmbientBackdrop() {
  return (
    <div className="ambient-backdrop" aria-hidden>
      <span className="ab-blob ab1" />
      <span className="ab-blob ab2" />
      <span className="ab-blob ab3" />
      <span className="ab-line l1" />
      <span className="ab-line l2" />
      <span className="ab-line l3" />
    </div>
  );
}
