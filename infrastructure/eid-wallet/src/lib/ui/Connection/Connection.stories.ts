import Connection from "./Connection.svelte";

export default {
	title: "UI/Connection",
	component: Connection,
	tags: ["autodocs"],
	render: (args: any) => ({
		Component: Connection,
		props: args,
	}),
};

export const Primary = {
	args: {
		imgSrc:
			"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGPvo_J4nWlDM0kxFW0rsfR5UeOOC6uMvpfQ&s",
		connectionName: "Facebook.com",
		lastConnected:
			new Date().toDateString() + ", " + new Date().toLocaleTimeString(),
		onClick: () => alert("Disconnected!"),
	},
};
