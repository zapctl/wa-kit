import {
	HOSTED_LID_SUFFIX,
	HOSTED_SUFFIX,
	INTEROP_USER_JID_SUFFIX,
	LID_SUFFIX,
	MSGR_USER_JID_SUFFIX,
	USER_JID_SUFFIX,
	JidDomain,
	// @ts-ignore
} from "./constants";

export const JID_REGEX = Object.freeze(/^(?:(?:(\d+)-)?([0-9a-zA-Z]+)?(?::(\d+))?@)?([a-z.\-_]+)$/);

export interface JidOptions {
	user?: string;
	device?: number;
	integrator?: number;
	server?: string | JidDomain;
}

export class JID {
	user = "";
	device = 0;
	integrator = 0;
	server: string = "";

	constructor(jid: string | JidOptions) {
		if (typeof jid === "string") {
			const matches = jid.match(JID_REGEX);
			if (!matches) throw new Error("invalid jid string");

			this.user = matches[2] || "";
			this.device = parseInt(matches[3]) || 0;
			this.integrator = parseInt(matches[1]) || 0;
			this.server = matches[4] || "";
		} else if (typeof jid === "object") {
			this.user = jid.user || "";
			this.device = jid.device || 0;
			this.integrator = jid.integrator || 0;
			if (typeof jid.server === "string") this.server = jid.server || "";
			else this.domain = jid.server;
		} else {
			throw new Error("invalid jid constructor");
		}
	}

	get domain(): JidDomain | undefined {
		return {
			[USER_JID_SUFFIX]: JidDomain.WhatsApp,
			[LID_SUFFIX]: JidDomain.Lid,
			[HOSTED_SUFFIX]: JidDomain.Hosted,
			[HOSTED_LID_SUFFIX]: JidDomain.HostedLid,
		}[this.server];
	}

	set domain(domain: JidDomain | undefined) {
		if (!domain) {
			this.server = "";
			return;
		}

		this.server = {
			[JidDomain.WhatsApp]: USER_JID_SUFFIX,
			[JidDomain.Lid]: LID_SUFFIX,
			[JidDomain.Hosted]: HOSTED_SUFFIX,
			[JidDomain.HostedLid]: HOSTED_LID_SUFFIX,
		}[domain] ?? "";
	}

	equals(jid: JID) {
		return this.user === jid.user &&
			this.device === jid.device &&
			this.integrator === jid.integrator &&
			this.server === jid.server;
	}

	toString() {
		const integrator = this.integrator > 0 ? `${this.integrator}-` : "";
		const device = this.device > 0 ? `:${this.device}` : "";
		const hasLeft = this.integrator > 0 || !!this.user || this.device > 0;
		const left = hasLeft ? `${integrator}${this.user}${device}@` : "";

		return `${left}${this.server}`;
	}

	toJSON() {
		return this.toString();
	}
}

export interface JidPairOptions {
	user?: string;
	server?: string;
}

export class JID_PAIR extends JID {
	constructor(jid: JidPairOptions | string) {
		super(typeof jid === "object" ? {
			user: jid.user,
			server: jid.server,
		} : jid);

		if (!this.server) this.server = USER_JID_SUFFIX;
	}

	equals(jid: JID) {
		return this.user === jid.user &&
			this.server === jid.server;
	}
}

export interface JidAdOptions {
	user?: string;
	device?: number;
	server?: JidDomain | string;
}

export class JID_AD extends JID {
	constructor(jid: string | JidAdOptions) {
		super(typeof jid === "object" ? {
			user: jid.user,
			server: jid.server,
			device: jid.device,
		} : jid);

		if (!this.server) this.server = USER_JID_SUFFIX;
	}

	equals(jid: JID) {
		return this.user === jid.user &&
			this.device === jid.device &&
			this.server === jid.server;
	}
}

export interface JidFBOptions {
	user?: string;
	device?: number;
	server?: JidDomain | string;
}

export class JID_FB extends JID {
	constructor(jid: string | JidFBOptions) {
		super(jid);
		if (!this.server) this.server = MSGR_USER_JID_SUFFIX;
	}

	equals(jid: JID) {
		return this.user === jid.user &&
			this.device === jid.device &&
			this.server === jid.server;
	}
}

export interface JidInteropOptions {
	user?: string;
	device?: number;
	integrator?: number;
	server?: JidDomain | string;
}

export class JID_INTEROP extends JID {
	constructor(jid: string | JidInteropOptions) {
		super(jid);
		if (!this.server) this.server = INTEROP_USER_JID_SUFFIX;
	}

	equals(jid: JID) {
		return this.user === jid.user &&
			this.device === jid.device &&
			this.integrator === jid.integrator &&
			this.server === jid.server;
	}
}

export class JIDSet<T extends JID = JID> extends Set<T> {
	constructor(jids?: T[] | JIDSet<T>) {
		super();

		for (const jid of jids || []) {
			this.add(jid);
		}
	}

	private findEquivalent(jid: T): JID | undefined {
		for (const item of this) {
			if (item.equals(jid)) {
				return item;
			}
		}
	}

	has(jid: T): boolean {
		return !!this.findEquivalent(jid);
	}

	add(...jids: T[]): this {
		for (const jid of jids) {
			const existing = this.findEquivalent(jid);

			if (!existing) super.add(jid);
		}

		return this;
	}

	delete(...jids: T[]): boolean {
		let someDeleted = false;

		for (const jid of jids) {
			for (const item of this) {
				if (item.equals(jid) && super.delete(item)) {
					someDeleted = true;
				}
			}
		}

		return someDeleted;
	}
}