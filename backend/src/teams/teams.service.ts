import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private readonly memberRepo: Repository<TeamMember>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async createTeam(name: string) {
    if (!name?.trim()) throw new BadRequestException('Naziv tima je obavezan');
    const existing = await this.teamRepo.findOne({ where: { name } });
    if (existing) throw new BadRequestException('Tim sa tim imenom već postoji');
    
    // Assign default emoji logo based on team count
    const count = await this.teamRepo.count();
    const logos = ['🚀', '⚡', '🔥', '💎', '⭐', '🎯', '💪', '🏆', '⚙️', '🌟'];
    const defaultLogo = logos[count % logos.length];
    
    const team = this.teamRepo.create({ name, logo: defaultLogo } as any);
    return this.teamRepo.save(team);
  }

  async listTeams() {
    const teams = await this.teamRepo.find();
    const teamIds = teams.map(t => t.id);
    const members = teamIds.length ? await this.memberRepo.find({ where: { team_id: In(teamIds) } }) : [];
    const grouped = new Map<number, TeamMember[]>();
    members.forEach(m => {
      const arr = grouped.get(m.team_id) || [];
      arr.push(m);
      grouped.set(m.team_id, arr);
    });
    return teams.map(t => ({ ...t, members: grouped.get(t.id) || [] }));
  }

  async addMembers(teamId: number, userIds: number[], move = false) {
    if (!userIds?.length) {
      const currentCount = await this.memberRepo.count({ where: { team_id: teamId } as any });
      return { added: 0, capacity_remaining: Math.max(0, 2 - currentCount) };
    }
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Tim ne postoji');
    // Hard limit: maksimalno 2 člana po timu
    const currentCount = await this.memberRepo.count({ where: { team_id: teamId } as any });
    const capacityRemaining = Math.max(0, 2 - currentCount);
    if (currentCount >= 2) {
      throw new BadRequestException(`Tim već ima maksimalan broj članova (2). capacity_remaining=0`);
    }
    // Hard rule: korisnik ne može biti u više timova
    const conflicts = await this.memberRepo.createQueryBuilder('m')
      .where('m.user_id IN (:...uids)', { uids: userIds })
      .getMany();
    const inOtherTeams = conflicts.filter(m => m.team_id !== teamId);
    if (inOtherTeams.length > 0 && !move) {
      const bad = inOtherTeams.slice(0, 5).map(m => `user_id=${m.user_id}`).join(', ');
      throw new BadRequestException(`Neki korisnici su već članovi drugih timova: ${bad}${inOtherTeams.length>5?'…':''}. Dodajte sa move=true za premeštanje. capacity_remaining=${capacityRemaining}`);
    }
    // Ako je move=true, ukloni postojeća članstva korisnika iz drugih timova
    if (inOtherTeams.length > 0 && move) {
      const idsToRemove = inOtherTeams.map(m => m.id);
      if (idsToRemove.length) {
        await this.memberRepo.delete(idsToRemove);
      }
    }
    const validUsers = await this.userRepo.find({ where: { id: In(userIds) } });
    const validIds = new Set(validUsers.map(u => u.id));
    const rows: TeamMember[] = [];
    // izbegni duplikate i već postojeće u timu
    const uniqueIds = Array.from(new Set(userIds)).filter(id => validIds.has(id));
    for (const uid of uniqueIds) {
      if (!validIds.has(uid)) continue;
      const exists = await this.memberRepo.findOne({ where: { team_id: teamId, user_id: uid } });
      if (exists) continue;
      // Enforce capacity before adding
      if ((currentCount + rows.length) >= 2) {
        throw new BadRequestException('Maksimalno 2 člana po timu. Uklonite člana pre dodavanja novog.');
      }
      rows.push(this.memberRepo.create({ team_id: teamId, user_id: uid }));
    }
    if (rows.length) await this.memberRepo.save(rows);
    const newCount = await this.memberRepo.count({ where: { team_id: teamId } as any });
    return { added: rows.length, capacity_remaining: Math.max(0, 2 - newCount), moved: move ? inOtherTeams.map(m=>m.user_id) : [] };
  }

  async removeMember(teamId: number, userId: number) {
    const row = await this.memberRepo.findOne({ where: { team_id: teamId, user_id: userId } });
    if (!row) return { removed: 0 };
    await this.memberRepo.delete({ id: row.id });
    return { removed: 1 };
  }

  async renameTeam(teamId: number, name: string) {
    if (!name?.trim()) throw new BadRequestException('Naziv tima je obavezan');
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Tim ne postoji');
    const exists = await this.teamRepo.findOne({ where: { name } });
    if (exists && exists.id !== teamId) throw new BadRequestException('Tim sa tim imenom već postoji');
    team.name = name;
    await this.teamRepo.save(team);
    return { ok: true, id: teamId, name };
  }

  async deleteTeam(teamId: number) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) return { deleted: 0 };
    await this.teamRepo.delete({ id: teamId });
    return { deleted: 1 };
  }
}
