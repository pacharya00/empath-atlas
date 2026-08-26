import Image from "next/image";
import AtlasMap from "@/components/AtlasMap";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialSites() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("sites").select("*").order("id", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("Could not load initial sites for server render:", err);
    return [];
  }
}

export default async function Home() {
  const initialSites = await getInitialSites();

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <a
            href="https://empathunits.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="brand-logo-link"
            aria-label="EmPATH Consulting website"
          >
            <Image
              src="/empath-logo.png"
              alt="EmPATH Consulting"
              width={446}
              height={142}
              className="brand-logo"
              priority
            />
          </a>
          <p className="brand-eyebrow">Internal &middot; EmPATH Consulting Team</p>
          <h1>The EmPATH Unit Atlas</h1>
          <p className="subhead">
            Our working roster of every hospital-based Emergency Psychiatric Assessment, Treatment &amp; Healing unit
            tracked so far, plus EmPATH-like units built on a similar model. Filter here, then export a list below to
            share outside the team.
          </p>
        </div>
        <div className="stat-row" id="statRow"></div>
      </header>
      <main className="layout">
        <aside className="panel rail">
          <div>
            <h2>Region</h2>
            <div className="region-toggle" id="regionToggle">
              <button data-region="us" className="active">United States</button>
              <button data-region="world">World</button>
            </div>
          </div>
          <div>
            <h2>Site type</h2>
            <div className="chip-group" id="typeChips"></div>
          </div>
          <div>
            <h2>Find a site</h2>
            <input type="search" id="searchBox" placeholder="Name, city, or state&hellip;" />
          </div>
          <button className="reset-link" id="resetBtn">Reset filters</button>
          <button className="add-unit-btn" id="addUnitBtn">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M8 2.5v11M2.5 8h11" />
            </svg>
            Add a site
          </button>
        </aside>
        <div className="map-col">
          <div className="panel map-panel" id="mapPanel"></div>
          <div className="panel list-panel" id="listPanel"></div>
        </div>
      </main>
      <footer className="source-note">
        <span>
          <strong>Internal use only:</strong> this map reads live from the shared EmPATH Atlas database. Sites added
          here are saved straight to that database and appear for everyone. Use &quot;Export CSV&quot; above to share
          a filtered list externally, or &quot;Export full list&quot; for the complete master roster.
        </span>
        <span>
          <strong>Snapshot loaded:</strong> {new Date().toISOString().slice(0, 10)} <span id="liveStatus"></span>
        </span>
      </footer>
      <div className="tooltip" id="tooltip"></div>
      <div className="modal-overlay" id="modalOverlay" hidden>
        <div className="modal" id="modalPanel"></div>
      </div>
      <AtlasMap initialSites={initialSites} />
    </div>
  );
}
