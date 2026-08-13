import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import api from "../services/api";
import "./userSearch.css";

function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const id = ++requestId.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get("/users/search", { params: { q: trimmed } });
        if (id !== requestId.current) return;
        setResults(res.data.users || []);
        setHasSearched(true);
      } catch (error) {
        if (id !== requestId.current) return;
        console.log(error);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="user-search-page">
      <h1 className="user-search-title">Find people on Repvyn</h1>

      <div className="user-search-box">
        <SearchIcon size={18} className="user-search-icon" />
        <input
          className="user-search-input"
          type="text"
          placeholder="Search by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {searching && <p className="user-search-hint">Searching...</p>}

      {!searching && hasSearched && results.length === 0 && (
        <p className="user-search-hint">No users found for "{query.trim()}".</p>
      )}

      <ul className="user-search-results">
        {results.map((u) => (
          <li key={u.username}>
            <Link to={`/u/${u.username}`} className="user-search-result">
              <span className="user-search-avatar">{u.name?.charAt(0).toUpperCase() || "?"}</span>
              <span>
                <span className="user-search-result-name">{u.name}</span>
                <span className="user-search-result-handle">@{u.username}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserSearch;
