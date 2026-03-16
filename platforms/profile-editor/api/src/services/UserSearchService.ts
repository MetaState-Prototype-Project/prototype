import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";

export class UserSearchService {
	private userRepository: Repository<User>;

	constructor() {
		this.userRepository = AppDataSource.getRepository(User);
	}

	async searchUsers(
		query: string,
		page: number = 1,
		limit: number = 10,
		sortBy: string = "relevance",
	) {
		const searchQuery = query.trim();

		if (searchQuery.length < 1) {
			return { results: [], total: 0, page, limit, totalPages: 0 };
		}

		if (page < 1 || limit < 1 || limit > 100) {
			return { results: [], total: 0, page, limit, totalPages: 0 };
		}

		const queryBuilder = this.userRepository
			.createQueryBuilder("user")
			.select([
				"user.id",
				"user.ename",
				"user.name",
				"user.handle",
				"user.bio",
				"user.avatarFileId",
				"user.headline",
				"user.location",
				"user.skills",
				"user.isVerified",
			])
			.addSelect(
				`
				CASE
					WHEN user.ename ILIKE :exactQuery THEN 100
					WHEN COALESCE(user.name, '') ILIKE :exactQuery THEN 90
					WHEN user.handle ILIKE :exactQuery THEN 80
					WHEN user.ename ILIKE :query THEN 70
					WHEN COALESCE(user.name, '') ILIKE :query THEN 60
					WHEN user.handle ILIKE :query THEN 50
					WHEN COALESCE(user.headline, '') ILIKE :query THEN 45
					WHEN COALESCE(user.bio, '') ILIKE :query THEN 30
					WHEN COALESCE(user.location, '') ILIKE :query THEN 25
					WHEN user.ename ILIKE :fuzzyQuery THEN 40
					WHEN COALESCE(user.name, '') ILIKE :fuzzyQuery THEN 35
					WHEN user.handle ILIKE :fuzzyQuery THEN 30
					WHEN EXISTS (SELECT 1 FROM unnest(COALESCE(user.skills, ARRAY[]::text[])) AS s WHERE s ILIKE :query) THEN 20
					ELSE 0
				END`,
				"relevance_score",
			)
			.where(
				`(COALESCE(user.name, '') ILIKE :query OR user.ename ILIKE :query OR user.handle ILIKE :query
				OR COALESCE(user.headline, '') ILIKE :query OR COALESCE(user.bio, '') ILIKE :query OR COALESCE(user.location, '') ILIKE :query
				OR user.ename ILIKE :fuzzyQuery OR COALESCE(user.name, '') ILIKE :fuzzyQuery OR user.handle ILIKE :fuzzyQuery
				OR EXISTS (SELECT 1 FROM unnest(COALESCE(user.skills, ARRAY[]::text[])) AS s WHERE s ILIKE :query))`,
				{
					query: `%${searchQuery}%`,
					exactQuery: searchQuery,
					fuzzyQuery: `%${searchQuery.split("").join("%")}%`,
				},
			)
			.andWhere("user.isPublic = :isPublic", { isPublic: true })
			.andWhere("user.isArchived = :archived", { archived: false });

		switch (sortBy) {
			case "name":
				queryBuilder.orderBy("user.name", "ASC");
				break;
			case "newest":
				queryBuilder.orderBy("user.createdAt", "DESC");
				break;
			case "relevance":
			default:
				queryBuilder
					.orderBy("relevance_score", "DESC")
					.addOrderBy("user.isVerified", "DESC")
					.addOrderBy("user.name", "ASC");
				break;
		}

		const offset = (page - 1) * limit;
		queryBuilder.skip(offset).take(limit);

		const [results, total] = await queryBuilder.getManyAndCount();

		return {
			results: results.map((user) => ({
				id: user.id,
				ename: user.ename,
				name: user.name,
				handle: user.handle,
				bio: user.bio,
				avatarFileId: user.avatarFileId,
				headline: user.headline,
				location: user.location,
				skills: user.skills,
				isVerified: user.isVerified,
			})),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	async findByEname(ename: string): Promise<User | null> {
		return this.userRepository.findOneBy({ ename });
	}

	async upsertFromWebhook(data: Partial<User> & { ename: string }): Promise<User> {
		let user = await this.userRepository.findOneBy({ ename: data.ename });

		if (user) {
			for (const key of Object.keys(data)) {
				if (data[key as keyof User] !== undefined) {
					(user as any)[key] = data[key as keyof User];
				}
			}
			return this.userRepository.save(user);
		}

		user = this.userRepository.create(data);
		return this.userRepository.save(user);
	}
}
