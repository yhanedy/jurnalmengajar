// Konfigurasi Turso Engine Direct API
const TURSO_DATABASE_URL = "https://smada-db-yhanedy.turso.io";
const TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM1MjMwMTMsImlkIjoiMDFhMTkyNzMtODIwMS03MGZkLWEzYjEtYmIwYTQ5NGU2YzQ5Iiwia2lkIjoieEFIcDc0WGZzOC1wbm56RVd5QjE3clJPamp4ZzBIZFhaQXRMM1BUWlZfdyIsInJpZCI6IjgyYWM0Yjk3LWMxYmYtNGEwYi04OTYxLTU5MTllMTE3N2FhNSJ9.YFPWSmlxck02zjnaTK6LFgFZdI68uJRVbbn1FfqB6InO-w3LJODhGR58XEkROb6Fko8KIqYgz_J7ozCdgZ0UDQ";

/**
 * Fungsi pembantu eksekusi SQL kueri ke Turso Database via HTTP REST API
 * @param {string} sql - Perintah SQL (SELECT, INSERT, UPDATE, DELETE)
 * @param {Array} params - Parameter array untuk query
 */
async function queryTurso(sql, params = []) {
    try {
        const response = await fetch(`${TURSO_DATABASE_URL}/v2/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TURSO_AUTH_TOKEN.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [
                    {
                        type: "execute",
                        stmt: {
                            sql: sql,
                            args: params.map(p => {
                                if (p === null || p === undefined) return { type: "null" };
                                if (typeof p === "number") return { type: "integer", value: String(p) };
                                return { type: "text", value: String(p) };
                            })
                        }
                    },
                    { type: "close" }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Turso HTTP Error (${response.status}): ${errText}`);
        }

        const resJson = await response.json();
        const result = resJson.results[0];

        if (result.type === "error") {
            throw new Error(result.error.message);
        }

        const responseExec = result.response.result;
        if (!responseExec.cols || responseExec.cols.length === 0) {
            return [];
        }

        const columns = responseExec.cols.map(c => c.name);
        return responseExec.rows.map(row => {
            const obj = {};
            row.forEach((cell, idx) => {
                obj[columns[idx]] = cell.value;
            });
            return obj;
        });
    } catch (err) {
        console.error("Turso Query Error:", err);
        throw err;
    }
}
