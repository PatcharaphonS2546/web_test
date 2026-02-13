<script lang="ts">
  import { onMount } from "svelte";

  const LOGIN_PATH = "/api/login";
  const ME_PATH = "/api/me";
  const LOGOUT_PATH = "/api/logout";

  let username = "";
  let password = "";

  let loading = false;
  let checkingSession = true;
  let isAuthenticated = false;

  let me: { id?: number; username?: string; name?: string } | null = null;

  let statusCode: number | null = null;
  let error = "";
  let success = "";

  async function fetchMe(silentUnauthorized = false) {
    loading = true;
    error = "";
    success = "";
    statusCode = null;

    try {
      const res = await fetch(ME_PATH, {
        method: "GET",
        credentials: "include",
      });

      statusCode = res.status;

      if (!res.ok) {
        if (res.status === 401) {
          isAuthenticated = false;
          me = null;
          if (silentUnauthorized) {
            return;
          }
          throw new Error("Session expired. Please login again.");
        }
        throw new Error(`Failed to fetch profile (${res.status})`);
      }

      const data = await res.json();
      me = data?.user ?? data ?? null;
      isAuthenticated = true;
      success = "Logged in successfully";
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error occurred";
    } finally {
      loading = false;
    }
  }

  async function login() {
    loading = true;
    error = "";
    success = "";
    statusCode = null;

    try {
      const res = await fetch(LOGIN_PATH, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      statusCode = res.status;

      if (!res.ok) {
        let message = `Login failed (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) message = errData.error;
          if (errData?.message) message = errData.message;
        } catch {
          // ignore json parse error
        }
        throw new Error(message);
      }

      password = "";
      await fetchMe();
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error occurred";
    } finally {
      loading = false;
    }
  }

  async function logout() {
    loading = true;
    error = "";
    success = "";
    statusCode = null;

    try {
      const res = await fetch(LOGOUT_PATH, {
        method: "POST",
        credentials: "include",
      });

      statusCode = res.status;

      if (!res.ok) {
        throw new Error(`Logout failed (${res.status})`);
      }

      isAuthenticated = false;
      me = null;
      success = "Logged out";
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error occurred";
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await fetchMe(true);
    checkingSession = false;
  });
</script>

<main class="min-h-screen bg-slate-50 text-slate-900">
  <section class="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
    <header class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Secure Session
        </p>
        <h1 class="text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
          Login System
        </h1>
        <p class="max-w-xl text-base text-slate-600">
          Sign in to access your profile. Your session is stored in an HttpOnly cookie.
        </p>
      </div>
      <div class="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm">
        <span
          class={`h-2.5 w-2.5 rounded-full ${
            isAuthenticated ? "bg-emerald-500" : "bg-orange-400"
          }`}
        ></span>
        <span class="text-sm font-medium text-slate-700">
          {isAuthenticated ? "Authenticated" : "Guest"}
        </span>
      </div>
    </header>

    <div class="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
      <section class="rounded-2xl bg-white p-8 shadow-sm">
        <div class="space-y-2">
          <h2 class="text-xl font-semibold text-slate-900">
            {isAuthenticated ? "Your account" : "Welcome back"}
          </h2>
          <p class="text-sm text-slate-500">
            {isAuthenticated
              ? "You are signed in. You can refresh your profile or log out."
              : "Enter your credentials to continue."}
          </p>
        </div>

        {#if checkingSession}
          <div class="mt-6 space-y-3">
            <div class="h-3 w-full animate-pulse rounded-full bg-slate-100"></div>
            <div class="h-3 w-2/3 animate-pulse rounded-full bg-slate-100"></div>
            <p class="text-sm text-slate-500">Checking session...</p>
          </div>
        {:else}
          {#if isAuthenticated}
            <div class="mt-6 flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div class="grid h-12 w-12 place-items-center rounded-xl bg-indigo-100 text-lg font-bold text-indigo-700">
                {me?.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div>
                <p class="text-base font-semibold text-slate-900">{me?.name ?? "User"}</p>
                <p class="text-sm text-slate-500">@{me?.username ?? "-"}</p>
              </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-3">
              <button
                class="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
                on:click={fetchMe}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh profile"}
              </button>
              <button
                class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                on:click={logout}
                disabled={loading}
              >
                Logout
              </button>
            </div>
          {:else}
            <form class="mt-6 grid gap-4" on:submit|preventDefault={login}>
              <label class="grid gap-2 text-sm font-semibold text-slate-700">
                Username
                <input
                  class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  bind:value={username}
                  placeholder="Enter username"
                  autocomplete="username"
                  autofocus
                />
              </label>

              <label class="grid gap-2 text-sm font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  bind:value={password}
                  placeholder="Enter password"
                  autocomplete="current-password"
                />
              </label>

              <button
                class="mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={loading || !username || !password}
              >
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>
          {/if}
        {/if}
      </section>

      <aside class="flex h-fit flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Session details</h3>
          <p class="mt-1 text-sm text-slate-500">API endpoints used by this page.</p>
        </div>

        <ul class="space-y-2 text-sm text-slate-700">
          <li class="flex items-center justify-between gap-3">
            <span>Login</span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {LOGIN_PATH}
            </span>
          </li>
          <li class="flex items-center justify-between gap-3">
            <span>Profile</span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {ME_PATH}
            </span>
          </li>
          <li class="flex items-center justify-between gap-3">
            <span>Logout</span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {LOGOUT_PATH}
            </span>
          </li>
          {#if statusCode !== null}
            <li class="flex items-center justify-between gap-3">
              <span>Last status</span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {statusCode}
              </span>
            </li>
          {/if}
        </ul>

        {#if success}
          <div class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        {/if}
        {#if error}
          <div class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        {/if}
      </aside>
    </div>
  </section>
</main>
