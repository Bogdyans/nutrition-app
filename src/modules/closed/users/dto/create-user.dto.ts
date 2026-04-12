import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  passwordHash: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  username: string;
}
