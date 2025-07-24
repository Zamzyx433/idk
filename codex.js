(function () {
    'use strict';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const decodeTokenData = (token) => {
        try {
            const data = token.split(".")[1];
            const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
            return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
        } catch (e) {
            console.warn("[Codex Bypass] Failed to decode token:", e);
            return {};
        }
    };

    const fetchData = async (url, method, session, jsonData = null, referrer = null) => {
        const headers = {
            'Android-Session': session,
            'Content-Type': 'application/json'
        };
        if (referrer) headers['Task-Referrer'] = referrer;

        const response = await fetch(url, {
            method,
            headers,
            body: jsonData ? JSON.stringify(jsonData) : undefined
        });
        const data = await response.json();
        if (!data.success) throw new Error("Stage failed or invalid session");
        return data;
    };

    const main = async () => {
        const urlToken = new URLSearchParams(location.search).get("token");
        if (!urlToken) return;

        try {
            const session = urlToken;
            const validatedTokens = [];
            let stagesCompleted = 0;

            const stageData = await fetchData('https://api.codex.lol/v1/stage/stages', 'GET', session);
            if (stageData.authenticated) {
                GM_notification({ title: "Codex", text: "Already authenticated!", timeout: 4000 });
                return;
            }

            const stages = stageData.stages;
            for (const stage of stages) {
                const stageId = stage.uuid;
                const init = await fetchData('https://api.codex.lol/v1/stage/initiate', 'POST', session, { stageId });
                const token = init.token;
                await sleep(6000);

                const decoded = decodeTokenData(token);
                const referrer = decoded.link?.includes("loot-links") ? "https://loot-links.com/" :
                                 decoded.link?.includes("loot-link") ? "https://loot-link.com/" :
                                 "https://linkvertise.com/";
                const validate = await fetchData('https://api.codex.lol/v1/stage/validate', 'POST', session, { token }, referrer);

                validatedTokens.push({ uuid: stageId, token: validate.token });
                stagesCompleted++;
                GM_notification({ title: "Codex", text: `Stage ${stagesCompleted}/${stages.length} complete`, timeout: 3000 });
                await sleep(1500);
            }

            if (validatedTokens.length === stages.length) {
                await fetchData('https://api.codex.lol/v1/stage/authenticate', 'POST', session, { tokens: validatedTokens });
                GM_notification({ title: "Codex", text: "All stages completed! Reloading...", timeout: 4000 });
                setTimeout(() => location.reload(), 1500);
            }
        } catch (err) {
            GM_notification({ title: "Codex", text: `Error: ${err.message}`, timeout: 5000 });
            console.warn("[Codex Bypass]", err);
        }
    };

    main();
})();
