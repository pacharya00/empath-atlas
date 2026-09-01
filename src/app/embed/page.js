import AtlasMap from "@/components/AtlasMap";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
};

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

export default async function EmbedPage() {
  const initialSites = await getInitialSites();

  return (
    <div className="wrap">
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
        </aside>
        <div className="map-col">
          <div className="panel map-panel" id="mapPanel"></div>
        </div>
      </main>
      <div className="tooltip" id="tooltip"></div>
      <AtlasMap initialSites={initialSites} readOnly sitesEndpoint="/api/public/sites" />
    </div>
  );
}
