import IdentityCard from "./IdentityCard.svelte";

export default {
	title: "UI/IdentityCard",
	component: IdentityCard,
	tags: ["autodocs"],
	render: (args: any) => ({
		Component: IdentityCard,
		props: args,
	}),
};

export const eName = {
	args: {
		variant: "eName",
		userId: "ananyayayayaya",
		shareBtn: () => alert("Share"),
		viewBtn: () => alert("View"),
	},
};

export const ePassport = {
	args: {
		variant: "ePassport",
		viewBtn: () => alert("View"),
		userData: {
			Name: "Ananya",
			Dob: "29 Nov 2003",
			Nationality: "Indian",
			Passport: "234dfvgsdfg",
		},
	},
};

export const eVault = {
	args: {
		variant: "eVault",
		usedStorage: "15",
		totalStorage: "80",
	},
};
