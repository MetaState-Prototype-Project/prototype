<script lang="ts">
	import { onMount } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';

	let drawerElement: HTMLElement;
	let drawer: CupertinoPane;

	onMount(() => {
		if (!drawerElement) return;
		drawer = new CupertinoPane(drawerElement, {
			showDraggable: false,
			backdrop: true,
			backdropBlur: true,
			backdropOpacity: 0.4,
			animationType: 'ease',
			animationDuration: 300,
			bottomClose: true,
			buttonDestroy: false,
			cssClass: '',
			initialBreak: 'middle'
		});

		drawer.present();
	});
</script>

<div bind:this={drawerElement}>
	<h3>Hello, I'm a drawer!</h3>
	<p>
		Lorem ipsum dolor sit amet consectetur adipisicing elit. Nam iure voluptate illo quo neque
		aspernatur, ex minima velit veritatis deleniti deserunt! Excepturi voluptatum saepe
		veritatis ex quibusdam! Ab, sapiente quasi! Perspiciatis tempora repudiandae, deleniti est
		fugiat facere quo fugit ea quisquam sunt harum rerum officia dolores quaerat ipsam culpa
		recusandae rem consequuntur adipisci libero porro labore optio. Inventore, saepe iste.
		Ducimus impedit voluptas ea incidunt est voluptatem. Deleniti ipsam ea odio saepe eos
		officiis maxime ad natus laborum vitae maiores, dignissimos, aperiam a aliquam quod ut illo
		corrupti libero placeat. Libero aut tempora repellat odio nisi cum, fugiat minus, animi
		laboriosam eum perspiciatis eaque repellendus officia beatae et maxime nemo qui rem!
		Accusantium provident, hic laborum voluptatem nostrum rerum necessitatibus? Ducimus fugit
		totam quibusdam voluptatum illum necessitatibus quisquam, neque amet vero voluptates? Est
		excepturi, saepe voluptatem, maxime libero officiis exercitationem ipsa sunt ipsum facere
		consequuntur alias perferendis? Quia, hic doloremque. Veniam consequatur nesciunt totam
		asperiores quas nulla hic magni aliquam minus iste qui libero earum, voluptatibus illo
		accusamus ex doloribus nobis, minima perferendis distinctio blanditiis ipsam eos? Qui, sequi
		harum. Labore voluptates harum consequatur, dolores cum magni accusantium quis sit corporis
		quia tempora? A nemo sint, architecto soluta illo consequatur temporibus praesentium esse
		similique nisi nostrum itaque ut possimus dolorem. Perspiciatis asperiores quibusdam unde
		natus neque, deleniti nobis ea veritatis quis esse magni necessitatibus similique id
		impedit, dolorem doloremque. Harum corrupti enim incidunt cupiditate, quis autem
		necessitatibus quo dignissimos voluptatem. Consequatur rerum facilis sunt aliquid, sit
		assumenda harum illo a tempore voluptatum? Nam aliquid soluta nisi repellendus architecto,
		perspiciatis quo aperiam similique quibusdam nihil illum laborum neque ratione velit dolor.
		Id earum laboriosam reiciendis, pariatur expedita veniam nihil inventore nam aut tempore
		praesentium distinctio enim accusantium aliquid ullam sunt quia nisi perspiciatis. Odit
		fugiat molestiae modi nemo reprehenderit sed explicabo. Cupiditate excepturi ad provident
		architecto eaque doloremque, veniam similique perspiciatis laboriosam saepe molestias minus
		nostrum odio repellat necessitatibus, voluptatibus soluta maxime culpa delectus! Maxime
		laboriosam cum debitis aliquid eligendi aperiam. Repellendus, sapiente iusto, quos porro
		officiis hic alias in explicabo voluptates aperiam consequuntur blanditiis et perferendis
		maxime autem illum voluptas! Laborum atque debitis quisquam voluptatibus quo, fugiat numquam
		possimus vitae! Blanditiis animi ducimus atque ratione assumenda perferendis quidem! Illo
		officiis distinctio qui nesciunt perspiciatis animi blanditiis nobis, facere corrupti maxime
		mollitia totam! Optio animi necessitatibus, omnis ipsum libero voluptate laboriosam. Et
		soluta consectetur odio recusandae? Deserunt voluptas temporibus, ea ipsum ratione
		aspernatur ipsam minima? Aspernatur blanditiis mollitia laborum? Consequatur placeat earum
		reiciendis vel perferendis consequuntur qui minima, ipsam aliquid molestiae. Repellendus
		laborum libero voluptatibus repellat, quos incidunt numquam, ipsa alias, asperiores eaque
		saepe exercitationem dolorum ratione esse beatae. Voluptas adipisci id quibusdam. Eos ut
		temporibus nulla enim placeat ipsum impedit. Maxime molestiae atque sint deserunt? Cum
		incidunt error eaque, ullam iste ducimus ratione porro impedit saepe pariatur, eos
		necessitatibus. Cupiditate corrupti ipsam hic magnam repellat nihil qui, excepturi
		necessitatibus quae. Fuga aut asperiores, modi quo consectetur maxime, unde ratione facilis
		cum excepturi dolore autem. Vel iure voluptas recusandae quasi! Optio accusamus neque eaque?
		Dolorum eligendi earum quibusdam aliquid consequatur laudantium? Eaque iste officia
		voluptates quia eum harum doloribus, quae adipisci suscipit velit, a praesentium impedit
		nulla ipsa alias odio dolores temporibus, vero asperiores. Doloremque temporibus ducimus eos
		dolore aperiam iusto? Odit quam ipsam accusantium tempore quo porro! Et aliquam voluptatem
		maxime delectus praesentium porro optio iste molestias mollitia necessitatibus labore
		doloribus nobis libero sequi iure consectetur quia eligendi, consequatur perferendis?
		Molestias, delectus deleniti! Distinctio fugiat qui necessitatibus ratione atque? Voluptas
		magni hic amet laboriosam quisquam vitae nobis, officia ipsam minima nam facilis praesentium
		doloribus possimus deserunt quos sunt eos corrupti.
	</p>
</div>
